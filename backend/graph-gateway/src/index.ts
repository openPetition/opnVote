import fastify, { FastifyRequest, FastifyReply } from 'fastify'
import axios from 'axios'
import * as dotenv from 'dotenv'
import { logger } from './utils/logger'
import { shouldAlert } from './utils/alertThrottle'
dotenv.config()

const server = fastify({
  logger: true,
  trustProxy: 1,
  bodyLimit: parseInt(process.env.MAX_BODY_SIZE || '51200'),
})

server.register(require('@fastify/cors'), {
  origin: true,
})

const TEST_KEY = process.env.TEST_API_KEY || null

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
  allowList: (req: FastifyRequest) => isWhitelistedRequest(req),
})

const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT!

if (!GRAPHQL_ENDPOINT) {
  logger.error('GraphQL Gateway: GRAPHQL_ENDPOINT not set')
  throw new Error('GRAPHQL_ENDPOINT not configured. Please set GRAPHQL_ENDPOINT in env.')
}

const PORT = parseInt(process.env.PORT || '3000')
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '10000')
const MAX_QUERY_SIZE = parseInt(process.env.MAX_QUERY_SIZE || '10000')

const WHITELISTED_IPS = process.env.WHITELISTED_IPS
  ? process.env.WHITELISTED_IPS.split(',').map(ip => ip.trim())
  : []

function isWhitelistedRequest(req: FastifyRequest): boolean {
  const localIps = ['127.0.0.1', '::1', '::ffff:127.0.0.1']
  const allWhitelistedIps = [...localIps, ...WHITELISTED_IPS]
  return allWhitelistedIps.includes(req.ip)
}

function logGraphqlErrors(data: any): boolean {
  try {
    const errors = data?.errors
    if (!Array.isArray(errors) || errors.length === 0) return false
    const message = String(errors[0]?.message ?? 'unknown')
    if (shouldAlert(`graphql:${message.slice(0, 60)}`)) {
      logger.error(`GraphQL response contained errors: ${message}`)
    }
    return true
  } catch {
    return false
  }
}

const handleGraphqlRequest = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = request.body as any

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      !body.query ||
      typeof body.query !== 'string'
    ) {
      return reply.status(400).send({
        errors: [
          {
            message: 'Invalid Request',
            extensions: {
              code: 'BAD_REQUEST',
            },
          },
        ],
      })
    }

    const queryValidation = validateQuerySize(body.query)
    if (!queryValidation.valid) {
      return reply.status(400).send({
        errors: [
          {
            message: queryValidation.error,
            extensions: {
              code: 'QUERY_TOO_LARGE',
              querySize: queryValidation.size,
              maxSize: MAX_QUERY_SIZE,
            },
          },
        ],
      })
    }

    const { data, statusCode } = await processGraphQLRequest(body)
    return reply.status(statusCode).send(data)
  } catch (error: any) {
    logger.error(`Error processing request: ${error?.message ?? error}`)
    return reply.status(500).send({
      errors: [
        {
          message: 'Internal error',
          extensions: {
            code: 'INTERNAL_ERROR',
          },
        },
      ],
    })
  }
}

function validateQuerySize(query: string): { valid: boolean; error?: string; size?: number } {
  if (!query || typeof query !== 'string') {
    return { valid: true }
  }

  const querySize = Buffer.byteLength(query, 'utf8')

  if (querySize > MAX_QUERY_SIZE) {
    if (shouldAlert('query-too-large')) {
      logger.warn(`Query too large: ${querySize} bytes (max: ${MAX_QUERY_SIZE})`)
    }
    return {
      valid: false,
      error: `Query too large: ${querySize} bytes, allowed: ${MAX_QUERY_SIZE} bytes`,
      size: querySize,
    }
  }

  return { valid: true, size: querySize }
}

async function processGraphQLRequest(graphqlRequest: any) {
  try {
    logger.info(`Processing GraphQL request`)

    const response = await axios.post(GRAPHQL_ENDPOINT, graphqlRequest, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: REQUEST_TIMEOUT,
    })

    if (!logGraphqlErrors(response.data)) {
      logger.info(`✅ GraphQL request successful`)
    }
    return { data: response.data, statusCode: response.status }
  } catch (error: any) {
    const errorMsg =
      error.code === 'ECONNABORTED'
        ? 'Timeout'
        : error.code === 'ECONNREFUSED'
        ? 'Connection refused'
        : error.response?.status
        ? `HTTP ${error.response.status}`
        : error.message || 'Unknown error'

    if (shouldAlert(`graphql-failed: ${errorMsg}`)) {
      logger.error(`❌ GraphQL request failed: ${errorMsg}`)
    }

    if (error.response) {
      return {
        data: error.response.data || {
          errors: [
            {
              message: 'GraphQL endpoint unavailable',
              extensions: {
                code: 'INTERNAL_ERROR',
              },
            },
          ],
        },
        statusCode: error.response.status,
      }
    }

    return {
      data: {
        errors: [
          {
            message: 'GraphQL endpoint unavailable',
            extensions: {
              code: 'INTERNAL_ERROR',
            },
          },
        ],
      },
      statusCode: 503,
    }
  }
}

const handleHealthRequest = async () => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    graphqlEndpoint: {} as any,
  }

  return healthStatus
}

server.after(() => {
  server.post('/', handleGraphqlRequest)
  server.get('/health', handleHealthRequest)
})

const start = async () => {
  try {
    await server.listen({ port: PORT, host: '0.0.0.0' })
    logger.info(`🚀 GraphQL Gateway server listening on port ${PORT}`)
    logger.info(`GraphQL endpoint: ${new URL(GRAPHQL_ENDPOINT).hostname}`)
    logger.info(`Request timeout: ${REQUEST_TIMEOUT}ms`)
    logger.info(`Max query size: ${MAX_QUERY_SIZE} bytes`)

    const localIps = ['127.0.0.1', '::1', '::ffff:127.0.0.1']
    const allWhitelistedIps = [...localIps, ...WHITELISTED_IPS]
    logger.info(`🔒 Whitelisted IPs (unrestricted access): ${allWhitelistedIps.join(', ')}`)
    if (WHITELISTED_IPS.length > 0) {
      logger.info(`Custom whitelisted IPs from env: ${WHITELISTED_IPS.join(', ')}`)
    }
  } catch (err: any) {
    logger.error(`GraphQL Gateway failed to start: ${err?.message ?? err}`)
    process.exit(1)
  }
}

process.on('unhandledRejection', reason => {
  logger.error(
    `GraphQL Gateway: Exiting! Unhandled promise rejection: ${(reason as any)?.message ?? reason}`,
  )
  process.exit(1)
})

process.on('uncaughtException', err => {
  logger.error(`GraphQL Gateway: Exiting! Uncaught exception: ${err?.message ?? err}`)
  process.exit(1)
})

start()
