import fastify, { FastifyRequest, FastifyReply } from 'fastify'
import axios from 'axios'
import * as dotenv from 'dotenv'
import { logger } from './utils/logger'
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

const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT!

if (!GRAPHQL_ENDPOINT) {
  throw new Error('GRAPHQL_ENDPOINT not configured. Please set GRAPHQL_ENDPOINT in env.')
}

const PORT = parseInt(process.env.PORT || '3000')
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '10000')
const MAX_QUERY_SIZE = parseInt(process.env.MAX_QUERY_SIZE || '10000')

const WHITELISTED_IPS = process.env.WHITELISTED_IPS
  ? process.env.WHITELISTED_IPS.split(',').map(ip => ip.trim())
  : []

server.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = request.body as any

    if (!body || typeof body !== 'object') {
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
  } catch (error) {
    logger.error('Error processing request:', error)
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
})

function validateQuerySize(query: string): { valid: boolean; error?: string; size?: number } {
  if (!query || typeof query !== 'string') {
    return { valid: true }
  }

  const querySize = Buffer.byteLength(query, 'utf8')

  if (querySize > MAX_QUERY_SIZE) {
    logger.warn(`Query too large: ${querySize} bytes (max: ${MAX_QUERY_SIZE})`)
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

    logger.info(`✅ GraphQL request successful`)
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

    logger.error(`❌ GraphQL request failed: ${errorMsg}`)

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

server.get('/health', async () => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    graphqlEndpoint: {} as any,
  }

  return healthStatus
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
  } catch (err) {
    logger.error(err)
    process.exit(1)
  }
}

start()
