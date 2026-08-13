import 'dotenv/config'
import fastify, { FastifyRequest, FastifyReply } from 'fastify'
import axios from 'axios'
import { logger } from './utils/logger'
import { shouldAlert } from './utils/alertThrottle'
import { registerBundlerRoute } from './bundler'

const server = fastify({ logger: false, trustProxy: 1 })

server.register(require('@fastify/cors'), {
  origin: true,
})

const TEST_KEY = process.env.TEST_API_KEY || null

server.register(require('@fastify/rate-limit'), {
  max: (req: FastifyRequest) => {
    const apiKey = req.headers['x-api-key'] as string
    return apiKey === TEST_KEY
      ? Number(process.env.RPC_RATE_LIMIT_MAX_TEST) || 5000
      : Number(process.env.RPC_RATE_LIMIT_MAX) || 120
  },
  timeWindow: '1 minute',
  keyGenerator: (req: FastifyRequest) => {
    const apiKey = req.headers['x-api-key'] as string
    return apiKey === TEST_KEY ? `test-${apiKey}` : req.ip
  },
  allowList: (req: FastifyRequest) => isWhitelistedRequest(req),
})

const RPC_ENDPOINTS = [process.env.PRIMARY_RPC_URL, process.env.SECONDARY_RPC_URL].filter(
  (url): url is string => Boolean(url),
)

if (RPC_ENDPOINTS.length === 0) {
  logger.error('RPC Gateway: no RPC endpoint set')
  throw new Error(
    'No RPC endpoints configured. Please set PRIMARY_RPC_URL and SECONDARY_RPC_URL in env.',
  )
}

const PORT = parseInt(process.env.PORT || '3000')
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '10000')
const SYNC_CHECK_INTERVAL = parseInt(process.env.SYNC_CHECK_INTERVAL || '60000')
const WARNING_BLOCK_LAG = parseInt(process.env.WARNING_BLOCK_LAG || '3')
const FAILOVER_BLOCK_LAG = parseInt(process.env.FAILOVER_BLOCK_LAG || '5')
const MAX_BATCH_SIZE = parseInt(process.env.MAX_BATCH_SIZE || '20')
const SECONDARY_UNREACHABLE_THRESHOLD = 3

let primaryBlockNumber: number | null = null
let secondaryBlockNumber: number | null = null
let usePrimaryNode = true
let secondaryUnreachableCount = 0
let lastNodeState: string | null = null

function setNodeState(state: string, level: 'error' | 'warn' | 'info', message: string): void {
  if (lastNodeState === state) return
  lastNodeState = state
  if (level === 'error') {
    logger.error(message)
  } else if (level === 'warn') {
    logger.warn(message)
  } else {
    logger.info(message)
  }
}

const ALLOWED_METHODS = [
  'eth_blockNumber',
  'eth_getBalance',
  'eth_getTransactionCount',
  'eth_call',
  'eth_estimateGas',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_chainId',
  'eth_getTransactionReceipt',
  'eth_getCode',
]

const WHITELISTED_IPS = process.env.WHITELISTED_IPS
  ? process.env.WHITELISTED_IPS.split(',').map(ip => ip.trim())
  : []

function isWhitelistedRequest(req: FastifyRequest): boolean {
  const localIps = ['127.0.0.1', '::1', '::ffff:127.0.0.1']
  const allWhitelistedIps = [...localIps, ...WHITELISTED_IPS]
  return allWhitelistedIps.includes(req.ip)
}

async function getBlockNumber(rpcUrl: string): Promise<number | null> {
  try {
    const response = await axios.post<any>(
      rpcUrl,
      { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 },
      { headers: { 'Content-Type': 'application/json' }, timeout: 5000 },
    )
    const hex = response.data?.result
    return hex ? parseInt(hex, 16) : null
  } catch {
    return null
  }
}

async function checkNodeSync(): Promise<void> {
  if (RPC_ENDPOINTS.length < 2) return

  primaryBlockNumber = await getBlockNumber(RPC_ENDPOINTS[0])
  secondaryBlockNumber = await getBlockNumber(RPC_ENDPOINTS[1])

  if (primaryBlockNumber === null) {
    if (secondaryBlockNumber === null) {
      setNodeState('all-down', 'error', `All RPC nodes down (primary and secondary)`)
    } else {
      setNodeState('primary-down', 'error', `Primary node down`)
    }
    usePrimaryNode = false
    return
  }

  if (secondaryBlockNumber === null) {
    secondaryUnreachableCount++
    if (secondaryUnreachableCount >= SECONDARY_UNREACHABLE_THRESHOLD) {
      setNodeState(
        'secondary-down',
        'warn',
        `Secondary node down: connection failed ${secondaryUnreachableCount} times`,
      )
    }
    usePrimaryNode = true
    return
  }

  if (secondaryUnreachableCount > 0) {
    logger.info(`Secondary node recovered after ${secondaryUnreachableCount} fails`)
    secondaryUnreachableCount = 0
  }

  const primaryBehind = secondaryBlockNumber - primaryBlockNumber
  const secondaryBehind = primaryBlockNumber - secondaryBlockNumber

  if (primaryBehind >= FAILOVER_BLOCK_LAG) {
    setNodeState(
      'primary-lagging',
      'error',
      `Primary node ${primaryBehind} blocks behind secondary! Failing over`,
    )
    usePrimaryNode = false
  } else if (primaryBehind >= WARNING_BLOCK_LAG) {
    setNodeState('primary-behind', 'warn', `Primary node ${primaryBehind} blocks behind secondary`)
    usePrimaryNode = true
  } else if (secondaryBehind >= FAILOVER_BLOCK_LAG) {
    setNodeState(
      'secondary-behind',
      'warn',
      `Secondary node ${secondaryBehind} blocks behind primary`,
    )
    usePrimaryNode = true
  } else {
    const isFirstCheck = lastNodeState === null
    const message = usePrimaryNode
      ? `✅ Both nodes reachable`
      : `✅ Primary node in sync. Switching back to primary`
    setNodeState('healthy', isFirstCheck ? 'info' : 'warn', message)
    usePrimaryNode = true
  }
}

const handleRpcRequest = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = request.body as any

    if (!body || typeof body !== 'object') {
      return reply.status(400).send({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request',
        },
        id: body?.id || null,
      })
    }

    if (Array.isArray(body)) {
      if (body.length === 0 || (!isWhitelistedRequest(request) && body.length > MAX_BATCH_SIZE)) {
        return reply.status(400).send({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: `Request exceeds batch size limit`,
          },
          id: null,
        })
      }
      const responses = await Promise.all(body.map(req => processRPCRequest(req, request)))
      return reply.send(responses)
    }

    const response = await processRPCRequest(body, request)
    return reply.send(response)
  } catch (error: any) {
    logger.error(`Error processing request: ${error?.message ?? error}`)
    return reply.status(500).send({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error',
      },
      id: null,
    })
  }
}

async function processRPCRequest(rpcRequest: any, request: FastifyRequest) {
  if (!rpcRequest || !rpcRequest.jsonrpc || !rpcRequest.method || rpcRequest.id === undefined) {
    return {
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'Invalid Request',
      },
      id: rpcRequest?.id || null,
    }
  }

  if (!isWhitelistedRequest(request) && !ALLOWED_METHODS.includes(rpcRequest.method)) {
    return {
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: `Method not allowed: ${rpcRequest.method}`,
      },
      id: rpcRequest.id,
    }
  }

  const orderedEndpoints = usePrimaryNode
    ? RPC_ENDPOINTS
    : [RPC_ENDPOINTS[1], RPC_ENDPOINTS[0]].filter(Boolean)

  for (let i = 0; i < orderedEndpoints.length; i++) {
    const rpcUrl = orderedEndpoints[i]
    const endpointName = `RPC-${i + 1} (${new URL(rpcUrl).hostname})`

    try {
      logger.info(`Attempting request to ${endpointName} for method: ${rpcRequest.method}`)

      const response = await axios.post(rpcUrl, rpcRequest, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: REQUEST_TIMEOUT,
      })

      const upstreamError = (response.data as any)?.error
      if (upstreamError && shouldAlert(`upstream:${endpointName}:${upstreamError.code}`)) {
        logger.warn(
          `Upstream error from ${endpointName}: ${upstreamError.code} ${upstreamError.message} for: ${rpcRequest.method}`,
        )
      }

      logger.info(`✅ Success: ${endpointName} responded for method: ${rpcRequest.method}`)
      return response.data
    } catch (error: any) {
      const errorMsg =
        error.code === 'ECONNABORTED'
          ? 'Timeout'
          : error.code === 'ECONNREFUSED'
            ? 'Connection refused'
            : error.response?.status
              ? `HTTP ${error.response.status}`
              : error.message || 'Unknown error'

      if (shouldAlert(`endpoint-failed:${endpointName}:${errorMsg}`)) {
        logger.error(`Failed: ${endpointName} - ${errorMsg} for method: ${rpcRequest.method}`)
      }

      if (i < orderedEndpoints.length - 1) {
        logger.debug(`🔄 Failing over to next RPC endpoint...`)
        continue
      }
    }
  }

  if (shouldAlert('all-endpoints-failed')) {
    logger.error(`All RPC endpoints failed for method: ${rpcRequest.method}`)
  }

  return {
    jsonrpc: '2.0',
    error: {
      code: -32603,
      message: 'All RPC endpoints unavailable',
    },
    id: rpcRequest.id,
  }
}

const handleHealthRequest = async (request: FastifyRequest, reply: FastifyReply) => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    syncStatus: {
      usePrimaryNode,
      primaryBlockNumber,
      secondaryBlockNumber,
    },
    rpcEndpoints: [] as any[],
  }

  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    const rpcUrl = RPC_ENDPOINTS[i]
    const endpointName = `RPC-${i + 1}`

    try {
      const testRequest = {
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }

      const response = await axios.post<any>(rpcUrl, testRequest, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      })

      const blockNumber = response.data?.result ? parseInt(response.data.result, 16) : null

      healthStatus.rpcEndpoints.push({
        name: endpointName,
        status: 'healthy',
        blockNumber,
      })
    } catch (error: any) {
      healthStatus.rpcEndpoints.push({
        name: endpointName,
        status: 'unhealthy',
        error: error.code || error.message,
      })
    }
  }

  return healthStatus
}

server.after(() => {
  registerBundlerRoute(server)
  server.post('/', handleRpcRequest)
  server.get('/health', handleHealthRequest)
})

const start = async () => {
  try {
    await server.listen({ port: PORT, host: '0.0.0.0' })
    logger.info(`🚀 RPC Gateway server listening on port ${PORT}`)
    logger.info(`📡 Configured RPC endpoints:`)
    RPC_ENDPOINTS.forEach((url, index) => {
      logger.info(
        `   ${index + 1}. ${new URL(url).hostname} (${index === 0 ? 'Primary' : 'Failover'})`,
      )
    })
    logger.info(`⏱️  Request timeout: ${REQUEST_TIMEOUT}ms`)

    const localIps = ['127.0.0.1', '::1', '::ffff:127.0.0.1']
    const allWhitelistedIps = [...localIps, ...WHITELISTED_IPS]
    logger.info(`🔒 Whitelisted IPs (unrestricted access): ${allWhitelistedIps.join(', ')}`)
    if (WHITELISTED_IPS.length > 0) {
      logger.info(`📋 Custom whitelisted IPs from env: ${WHITELISTED_IPS.join(', ')}`)
    }

    if (RPC_ENDPOINTS.length >= 2) {
      await checkNodeSync()
      setInterval(() => {
        checkNodeSync().catch(err => logger.error(`Node sync check failed: ${err?.message ?? err}`))
      }, SYNC_CHECK_INTERVAL)
      logger.info(
        `Node sync monitor started (interval: ${
          SYNC_CHECK_INTERVAL / 1000
        }s, warning: ${WARNING_BLOCK_LAG} blocks, failover: ${FAILOVER_BLOCK_LAG} blocks)`,
      )
    } else {
      logger.warn(`Node sync monitor disabled: Set 2 RPC endpoints`)
    }
  } catch (err: any) {
    logger.error(`RPC Gateway failed to start: ${err?.message ?? err}`)
    process.exit(1)
  }
}

process.on('unhandledRejection', reason => {
  logger.error(
    `RPC Gateway: exiting! Unhandled promise rejection: ${(reason as any)?.message ?? reason}`,
  )
  process.exit(1)
})

process.on('uncaughtException', err => {
  logger.error(`RPC Gateway: exiting! Uncaught exception: ${err?.message ?? err}`)
  process.exit(1)
})

start()
