import fastify, { FastifyRequest, FastifyReply } from 'fastify'
import axios from 'axios'
import * as dotenv from 'dotenv'
dotenv.config()

const server = fastify({ logger: true, trustProxy: true })

server.register(require('@fastify/cors'), {
  origin: true,
})

const TEST_KEY = process.env.TEST_API_KEY
if (!TEST_KEY) {
  throw new Error('TEST_API_KEY is not set')
}

server.register(require('@fastify/rate-limit'), {
  max: (req: FastifyRequest) => {
    const apiKey = req.headers['x-api-key'] as string
    return apiKey === TEST_KEY
      ? Number(process.env.RPC_RATE_LIMIT_MAX_TEST) || 5000
      : Number(process.env.RPC_RATE_LIMIT_MAX) || 60
  },
  timeWindow: '1 minute',
  keyGenerator: (req: FastifyRequest) => {
    const apiKey = req.headers['x-api-key'] as string
    return apiKey === TEST_KEY ? `test-${apiKey}` : req.ip
  },
})

const RPC_ENDPOINTS = [process.env.PRIMARY_RPC_URL, process.env.SECONDARY_RPC_URL].filter(
  (url): url is string => Boolean(url),
)

if (RPC_ENDPOINTS.length === 0) {
  throw new Error(
    'No RPC endpoints configured. Please set PRIMARY_RPC_URL and SECONDARY_RPC_URL in env.',
  )
}

const PORT = parseInt(process.env.PORT || '3000')
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '10000')

const ALLOWED_METHODS = [
  'eth_blockNumber',
  'eth_getTransactionCount',
  'eth_call',
  'eth_estimateGas',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_chainId',
  'eth_getTransactionReceipt',
]

const WHITELISTED_IPS = process.env.WHITELISTED_IPS
  ? process.env.WHITELISTED_IPS.split(',').map(ip => ip.trim())
  : []

function isWhitelistedRequest(req: FastifyRequest): boolean {
  const localIps = ['127.0.0.1', '::1', '::ffff:127.0.0.1']
  const allWhitelistedIps = [...localIps, ...WHITELISTED_IPS]
  return allWhitelistedIps.includes(req.ip)
}

server.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
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
      const responses = await Promise.all(body.map(req => processRPCRequest(req, request)))
      return reply.send(responses)
    }

    const response = await processRPCRequest(body, request)
    return reply.send(response)
  } catch (error) {
    server.log.error('Error processing request:', error)
    return reply.status(500).send({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error',
      },
      id: null,
    })
  }
})

async function processRPCRequest(rpcRequest: any, request: FastifyRequest) {
  if (!rpcRequest.jsonrpc || !rpcRequest.method || rpcRequest.id === undefined) {
    return {
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'Invalid Request',
      },
      id: rpcRequest.id || null,
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

  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    const rpcUrl = RPC_ENDPOINTS[i]
    const endpointName = `RPC-${i + 1} (${new URL(rpcUrl).hostname})`

    try {
      server.log.info(`Attempting request to ${endpointName} for method: ${rpcRequest.method}`)

      const response = await axios.post(rpcUrl, rpcRequest, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: REQUEST_TIMEOUT,
      })

      server.log.info(`✅ Success: ${endpointName} responded for method: ${rpcRequest.method}`)
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

      server.log.error(`❌ Failed: ${endpointName} - ${errorMsg} for method: ${rpcRequest.method}`)

      if (i < RPC_ENDPOINTS.length - 1) {
        server.log.warn(`🔄 Failing over to next RPC endpoint...`)
        continue
      }
    }
  }

  server.log.error(`💥 All RPC endpoints failed for method: ${rpcRequest.method}`)

  return {
    jsonrpc: '2.0',
    error: {
      code: -32603,
      message: 'All RPC endpoints unavailable',
    },
    id: rpcRequest.id,
  }
}

server.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
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

      await axios.post(rpcUrl, testRequest, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      })

      healthStatus.rpcEndpoints.push({
        name: endpointName,
        status: 'healthy',
        responseTime: 'ok',
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
})

const start = async () => {
  try {
    await server.listen({ port: PORT, host: '0.0.0.0' })
    server.log.info(`🚀 RPC Gateway server listening on port ${PORT}`)
    server.log.info(`📡 Configured RPC endpoints:`)
    RPC_ENDPOINTS.forEach((url, index) => {
      server.log.info(
        `   ${index + 1}. ${new URL(url).hostname} (${index === 0 ? 'Primary' : 'Failover'})`,
      )
    })
    server.log.info(`⏱️  Request timeout: ${REQUEST_TIMEOUT}ms`)

    const localIps = ['127.0.0.1', '::1', '::ffff:127.0.0.1']
    const allWhitelistedIps = [...localIps, ...WHITELISTED_IPS]
    server.log.info(`🔒 Whitelisted IPs (unrestricted access): ${allWhitelistedIps.join(', ')}`)
    if (WHITELISTED_IPS.length > 0) {
      server.log.info(`📋 Custom whitelisted IPs from env: ${WHITELISTED_IPS.join(', ')}`)
    }
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
