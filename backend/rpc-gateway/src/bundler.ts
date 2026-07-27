import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import axios from 'axios'
import { ethers } from 'ethers'
import { logger } from './utils/logger'
import opnvoteAbi from './abi/opnvote-0.4.0.json'
import accountAbi from './abi/account.json'

const ALLOWED_METHODS = new Set([
  'eth_sendUserOperation',
  'eth_getUserOperationReceipt',
  'eth_getUserOperationByHash',
  'pimlico_getUserOperationGasPrice',
  'eth_chainId',
])

const opnvoteIface = new ethers.Interface(opnvoteAbi)
const accountIface = new ethers.Interface(accountAbi)
const VOTE_SELECTOR = opnvoteIface.getFunction('vote')!.selector

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} not set`)
  }
  return value
}

function parsePaymasterPairs(raw: string): Map<string, { label: string; opnvote: string }> {
  const pairs = new Map<string, { label: string; opnvote: string }>()
  for (const entry of raw.split(',').map(e => e.trim()).filter(Boolean)) {
    const parts = entry.split(':').map(p => p.trim())
    if (parts.length !== 3 || parts.some(p => !p)) {
      throw new Error(`PAYMASTER_PAIRS: entry "${entry}" is invalid. Format should be "label:paymaster:sponsored-contract"`)
    }
    const [label, paymaster, opnvote] = parts
    if (!ethers.isAddress(paymaster) || !ethers.isAddress(opnvote)) {
      throw new Error(`PAYMASTER_PAIRS: invalid address: "${entry}"`)
    }
    pairs.set(paymaster.toLowerCase(), { label, opnvote: opnvote.toLowerCase() })
  }
  if (pairs.size === 0) {
    throw new Error('PAYMASTER_PAIRS: paymaster:sponsored contract pairs are required')
  }
  return pairs
}

const BUNDLER_URL = requireEnv('BUNDLER_URL')
const ENTRYPOINT_ADDRESS = requireEnv('ENTRYPOINT_ADDRESS').toLowerCase()
const PAYMASTER_PAIRS = parsePaymasterPairs(requireEnv('PAYMASTER_PAIRS'))
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '10000')
const GAS_PRICE_TTL = parseInt(process.env.BUNDLER_GAS_PRICE_TTL_MS || '2000')
const SEND_DEDUP_TTL = parseInt(process.env.BUNDLER_SEND_DEDUP_TTL_MS || '5000')

const provider = process.env.PRIMARY_RPC_URL
  ? new ethers.JsonRpcProvider(process.env.PRIMARY_RPC_URL)
  : null

let gasPriceCache: { at: number; result: any } | null = null

const recentSends = new Map<string, number>()
setInterval(() => {
  const cutoff = Date.now() - SEND_DEDUP_TTL
  for (const [k, t] of recentSends) if (t < cutoff) recentSends.delete(k)
}, SEND_DEDUP_TTL).unref()

function rpcError(id: any, code: number, message: string) {
  return { jsonrpc: '2.0', error: { code, message }, id: id ?? null }
}

function isDuplicateSend(userOp: Record<string, string>): boolean {
  const key = `${(userOp.sender ?? '').toLowerCase()}:${userOp.nonce}`
  if (recentSends.has(key)) return true
  recentSends.set(key, Date.now())
  return false
}

function validateSendUserOp(params: any[]): { error?: string; opnvote?: string } {
  const [userOp, entryPoint] = params as [Record<string, string>, string]
  if (typeof entryPoint !== 'string' || entryPoint.toLowerCase() !== ENTRYPOINT_ADDRESS) {
    return { error: 'Invalid entrypoint' }
  }
  const pair = PAYMASTER_PAIRS.get((userOp?.paymaster ?? '').toLowerCase())
  if (!pair) {
    return { error: 'Invalid paymaster' }
  }
  try {
    const [dest, value, func] = accountIface.decodeFunctionData('execute', userOp.callData)
    if (dest.toLowerCase() !== pair.opnvote) return { error: 'Invalid target' }
    if (value !== 0n) return { error: 'Non-zero value' }
    if (!String(func).startsWith(VOTE_SELECTOR)) return { error: 'Not a vote call' }
  } catch {
    return { error: 'Undecodable callData' }
  }
  return { opnvote: pair.opnvote }
}

async function canVotePrecheck(
  userOp: Record<string, string>,
  opnvoteAddress: string,
): Promise<string | null> {
  if (!provider) return null
  try {
    const [, , func] = accountIface.decodeFunctionData('execute', userOp.callData)
    const [electionId, voteEncrypted, voteEncryptedUser, unblindedSignature] =
      opnvoteIface.decodeFunctionData('vote', func)
    const data = opnvoteIface.encodeFunctionData('canVote', [
      electionId,
      userOp.sender,
      voteEncrypted,
      voteEncryptedUser,
      unblindedSignature,
    ])
    const raw = await provider.call({ to: opnvoteAddress, data })
    const [ok, reason] = opnvoteIface.decodeFunctionResult('canVote', raw)
    return ok ? null : `canVote: ${reason}`
  } catch (err: any) {
    if (err?.code === 'CALL_EXCEPTION') {
      logger.warn(
        `[Bundler] canVote reverted: reason=${err.reason ?? err.shortMessage} sender=${userOp.sender} callData=${userOp.callData}`,
      )
      return 'canVote reverted'
    }
    logger.warn(`[Bundler] canVote precheck skipped: ${err}`)
    return null
  }
}

async function forwardToBundler(payload: any): Promise<any> {
  const res = await axios.post<any>(BUNDLER_URL, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: REQUEST_TIMEOUT,
  })
  return res.data
}

export function registerBundlerRoute(server: FastifyInstance): void {
  server.post('/bundler', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any
    if (!body || body.jsonrpc !== '2.0' || !body.method || body.id === undefined) {
      return reply.status(400).send(rpcError(body?.id, -32600, 'Invalid Request'))
    }

    if (!ALLOWED_METHODS.has(body.method)) {
      logger.warn(`[Bundler] Rejected method: ${body.method}`)
      return reply.status(403).send(rpcError(body.id, -32601, `Method not allowed: ${body.method}`))
    }

    if (body.method === 'pimlico_getUserOperationGasPrice') {
      if (gasPriceCache && Date.now() - gasPriceCache.at < GAS_PRICE_TTL) {
        return reply.send({ jsonrpc: '2.0', result: gasPriceCache.result, id: body.id })
      }
      const res = await forwardToBundler(body)
      if (res.result) gasPriceCache = { at: Date.now(), result: res.result }
      return reply.send(res)
    }

    if (body.method === 'eth_sendUserOperation') {
      const { error: validationError, opnvote: opnvoteAddress } = validateSendUserOp(body.params)
      if (validationError || !opnvoteAddress) {
        logger.warn(`[Bundler] UserOp rejected: ${validationError} (ip=${request.ip})`)
        return reply.status(403).send(rpcError(body.id, -32602, validationError ?? 'Invalid userOp'))
      }
      if (isDuplicateSend(body.params[0])) {
        logger.warn(`[Bundler] Duplicate send (sender, nonce) rejected (ip=${request.ip})`)
        return reply.status(429).send(rpcError(body.id, -32005, 'Duplicate userOp'))
      }
      const canVoteError = await canVotePrecheck(body.params[0], opnvoteAddress)
      if (canVoteError) {
        logger.warn(`[Bundler] UserOp rejected: ${canVoteError} (ip=${request.ip})`)
        return reply.status(403).send(rpcError(body.id, -32602, canVoteError))
      }
    }

    try {
      return reply.send(await forwardToBundler(body))
    } catch (err) {
      logger.error(`[Bundler] ${body.method} failed:`, err)
      return reply.status(502).send(rpcError(body.id, -32603, 'Bundler request failed'))
    }
  })
}
