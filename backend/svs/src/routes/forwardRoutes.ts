import { Request, Response, Router } from 'express'
import { ApiResponse } from '../types/apiResponses'
import { logger } from '../utils/logger'

const ALLOWED_METHODS = new Set(['eth_sendUserOperation', 'eth_getUserOperationReceipt'])

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 10

export const ipRequests = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const timestamps = (ipRequests.get(ip) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  if (timestamps.length >= RATE_LIMIT_MAX) return true
  timestamps.push(now)
  ipRequests.set(ip, timestamps)
  return false
}

function validateSendUserOperation(
  params: unknown[],
  paymasterAddress: string,
  entryPointAddress: string,
): string | null {
  const [userOp, entryPoint] = params as [Record<string, string>, string]

  if (
    typeof entryPoint !== 'string' ||
    entryPoint.toLowerCase() !== entryPointAddress.toLowerCase()
  ) {
    return 'Invalid entrypoint'
  }

  const paymasterAndData: string = userOp?.paymasterAndData ?? ''
  if (paymasterAndData.slice(0, 42).toLowerCase() !== paymasterAddress.toLowerCase()) {
    return 'Invalid paymaster'
  }

  return null
}

const router = Router()

router.post('/', async (req: Request, res: Response) => {
  const ip = req.ip ?? 'unknown'
  if (isRateLimited(ip)) {
    logger.warn(`[Forward] Rate limit exceeded for ${ip}`)
    const response: ApiResponse<null> = { data: null, error: 'Rate limit exceeded' }
    return res.status(429).json(response)
  }

  const bundlerUrl: string | undefined = req.app.get('BUNDLER_URL')
  if (!bundlerUrl) {
    logger.error('[Forward] BUNDLER_URL not configured')
    const response: ApiResponse<null> = { data: null, error: 'Bundler not configured' }
    return res.status(500).json(response)
  }

  const { jsonrpc, method, params, id } = req.body

  if (jsonrpc !== '2.0' || !method || !Array.isArray(params)) {
    const response: ApiResponse<null> = { data: null, error: 'Invalid JSON-RPC request' }
    return res.status(400).json(response)
  }

  if (!ALLOWED_METHODS.has(method)) {
    logger.warn(`[Forward] Rejected method: ${method}`)
    const response: ApiResponse<null> = { data: null, error: `Method not allowed: ${method}` }
    return res.status(403).json(response)
  }

  if (method === 'eth_sendUserOperation') {
    const paymasterAddress: string = req.app.get('PAYMASTER_ADDRESS')
    const entryPointAddress: string = req.app.get('ENTRYPOINT_ADDRESS')
    const validationError = validateSendUserOperation(params, paymasterAddress, entryPointAddress)
    if (validationError) {
      logger.warn(`[Forward] UserOp rejected: ${validationError} (ip=${ip})`)
      const response: ApiResponse<null> = { data: null, error: validationError }
      return res.status(403).json(response)
    }
  }

  try {
    logger.info(`[Forward] ${method} (id=${id})`)

    const bundlerRes = await fetch(bundlerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc, method, params, id }),
    })

    const bundlerJson = await bundlerRes.json()

    const response: ApiResponse<typeof bundlerJson> = { data: bundlerJson, error: null }
    return res.status(200).json(response)
  } catch (err) {
    logger.error(`[Forward] ${method} failed:`, err)
    const response: ApiResponse<null> = { data: null, error: 'Bundler request failed' }
    return res.status(502).json(response)
  }
})

export default router
