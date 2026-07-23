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

const BUNDLER_URL = requireEnv('BUNDLER_URL')
const PAYMASTER_ADDRESS = requireEnv('PAYMASTER_ADDRESS').toLowerCase()
const ENTRYPOINT_ADDRESS = requireEnv('ENTRYPOINT_ADDRESS').toLowerCase()
const OPNVOTE_ADDRESS = requireEnv('OPNVOTE_CONTRACT_ADDRESS').toLowerCase()
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

function validateSendUserOp(params: any[]): string | null {
  const [userOp, entryPoint] = params as [Record<string, string>, string]
  if (typeof entryPoint !== 'string' || entryPoint.toLowerCase() !== ENTRYPOINT_ADDRESS) {
    return 'Invalid entrypoint'
  }
  if ((userOp?.paymaster ?? '').toLowerCase() !== PAYMASTER_ADDRESS) {
    return 'Invalid paymaster'
  }
  try {
    const [dest, value, func] = accountIface.decodeFunctionData('execute', userOp.callData)
    if (dest.toLowerCase() !== OPNVOTE_ADDRESS) return 'Invalid target'
    if (value !== 0n) return 'Non-zero value'
    if (!String(func).startsWith(VOTE_SELECTOR)) return 'Not a vote call'
  } catch {
    return 'Undecodable callData'
  }
  return null
}

async function canVotePrecheck(userOp: Record<string, string>): Promise<string | null> {
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
    const raw = await provider.call({ to: OPNVOTE_ADDRESS, data })
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
      const validationError = validateSendUserOp(body.params)
      if (validationError) {
        logger.warn(`[Bundler] UserOp rejected: ${validationError} (ip=${request.ip})`)
        return reply.status(403).send(rpcError(body.id, -32602, validationError))
      }
      if (isDuplicateSend(body.params[0])) {
        logger.warn(`[Bundler] Duplicate send (sender, nonce) rejected (ip=${request.ip})`)
        return reply.status(429).send(rpcError(body.id, -32005, 'Duplicate userOp'))
      }
      const canVoteError = await canVotePrecheck(body.params[0])
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
