import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import axios from 'axios'
import { ethers } from 'ethers'
import { logger } from './utils/logger'
import { shouldAlert } from './utils/alertThrottle'
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

if (!provider) {
  logger.error('[Bundler] PRIMARY_RPC_URL not set.')
  throw new Error('PRIMARY_RPC_URL not set.')
}

let gasPriceCache: { at: number; result: any } | null = null

const recentSends = new Map<string, number>()
setInterval(() => {
  const cutoff = Date.now() - SEND_DEDUP_TTL
  for (const [k, t] of recentSends) if (t < cutoff) recentSends.delete(k)
}, SEND_DEDUP_TTL).unref()

function logUpstreamResponse(method: string, res: any): void {
  try {
    if (res?.error) {
      const message = String(res.error.message ?? res.error.code ?? 'unknown')
      if (shouldAlert(`upstream: ${message.slice(0, 60)}`)) {
        logger.error(`[Bundler] ${method} upstream error: ${message}`)
      }
    } else if (method === 'eth_getUserOperationReceipt' && res?.result?.success === false) {
      const tx = res.result.receipt?.transactionHash
      if (shouldAlert(`reverted: ${tx}`)) {
        logger.error(`[Bundler] UserOp reverted: ${tx}`)
      }
    }
  } catch {
    return
  }
}

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
      if (shouldAlert(`canvote-reverted: ${err.reason ?? err.shortMessage}`)) {
        logger.warn(
          `[Bundler] canVote reverted: reason=${err.reason ?? err.shortMessage} sender=${userOp.sender} callData=${userOp.callData}`,
        )
      }
      return 'canVote reverted'
    }
    if (shouldAlert('canvote-skipped')) {
      logger.warn(`[Bundler] canVote check skipped: ${err?.message ?? err}`)
    }
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
      if (shouldAlert(`method: ${String(body.method).slice(0, 60)}`)) {
        logger.warn(`[Bundler] Rejected method: ${body.method}`)
      }
      return reply.status(403).send(rpcError(body.id, -32601, `Method not allowed: ${body.method}`))
    }

    if (body.method === 'pimlico_getUserOperationGasPrice') {
      if (gasPriceCache && Date.now() - gasPriceCache.at < GAS_PRICE_TTL) {
        return reply.send({ jsonrpc: '2.0', result: gasPriceCache.result, id: body.id })
      }
      try {
        const res = await forwardToBundler(body)
        if (res.result) gasPriceCache = { at: Date.now(), result: res.result }
        logUpstreamResponse(body.method, res)
        return reply.send(res)
      } catch (err: any) {
        if (shouldAlert('forward: pimlico_getUserOperationGasPrice')) {
          logger.error(`[Bundler] ${body.method} failed: ${err?.message ?? err}`)
        }
        return reply.status(502).send(rpcError(body.id, -32603, 'Bundler request failed'))
      }
    }

    if (body.method === 'eth_sendUserOperation') {
      const { error: validationError, opnvote: opnvoteAddress } = validateSendUserOp(body.params)
      if (validationError || !opnvoteAddress) {
        if (shouldAlert(`validation: ${validationError}`)) {
          logger.warn(`[Bundler] UserOp rejected: ${validationError} (ip=${request.ip})`)
        }
        return reply.status(403).send(rpcError(body.id, -32602, validationError ?? 'Invalid userOp'))
      }
      if (isDuplicateSend(body.params[0])) {
        if (shouldAlert('duplicate-send')) {
          logger.warn(`[Bundler] Duplicate send (sender, nonce) rejected (ip=${request.ip})`)
        }
        return reply.status(429).send(rpcError(body.id, -32005, 'Duplicate userOp'))
      }
      const canVoteError = await canVotePrecheck(body.params[0], opnvoteAddress)
      if (canVoteError) {
        if (shouldAlert(`canvote: ${canVoteError}`)) {
          logger.warn(`[Bundler] UserOp rejected: ${canVoteError} (ip=${request.ip})`)
        }
        return reply.status(403).send(rpcError(body.id, -32602, canVoteError))
      }
    }

    try {
      const res = await forwardToBundler(body)
      logUpstreamResponse(body.method, res)
      return reply.send(res)
    } catch (err: any) {
      if (shouldAlert(`forward: ${body.method}`)) {
        logger.error(`[Bundler] ${body.method} failed: ${err?.message ?? err}`)
      }
      return reply.status(502).send(rpcError(body.id, -32603, 'Bundler request failed'))
    }
  })
}
