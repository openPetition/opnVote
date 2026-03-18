import dotenv from 'dotenv'
dotenv.config()

import 'reflect-metadata'
import express, { Express } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { dataSource } from './database'
import signRoutes from './routes/signRoutes'
import sponsorRoutes from './routes/sponsorRoutes'
import forwardRoutes from './routes/forwardRoutes'
import swaggerUi from 'swagger-ui-express'
import swaggerSpec from './config/swaggerConfig'
import https from 'https'
import fs from 'fs'
import http from 'http'
import { ethers } from 'ethers'
import { logger } from './utils/logger'
import { getEnvVar } from './utils/utils'

require('dotenv').config()

const SSL_KEY_PATH = process.env.SSL_KEY_PATH
const SSL_CERT_PATH = process.env.SSL_CERT_PATH

const SERVER_URL = getEnvVar<string>('SERVER_URL', 'string')
const SVS_SIGN_KEY = getEnvVar<string>('SVS_SIGN_KEY', 'string')
const PAYMASTER_SIGNER_KEY = getEnvVar<string>('PAYMASTER_SIGNER_KEY', 'string')
const PAYMASTER_ADDRESS = getEnvVar<string>('PAYMASTER_ADDRESS', 'string')
const OPNVOTE_CONTRACT_ADDRESS = getEnvVar<string>('OPNVOTE_CONTRACT_ADDRESS', 'string')
const CHAIN_ID = getEnvVar<number>('CHAIN_ID', 'number')
const RPC_PROVIDER = getEnvVar<string>('RPC_PROVIDER', 'string')
const ENTRYPOINT_ADDRESS = getEnvVar<string>('ENTRYPOINT_ADDRESS', 'string')
const ACCOUNT_IMPLEMENTATION_ADDRESS = getEnvVar<string>('ACCOUNT_IMPLEMENTATION_ADDRESS', 'string')
const MAX_SPONSOR_COUNT = getEnvVar<number>('MAX_SPONSOR_COUNT', 'number')
const BUNDLER_URL = process.env.BUNDLER_URL

if ((SSL_KEY_PATH && !SSL_CERT_PATH) || (!SSL_KEY_PATH && SSL_CERT_PATH)) {
  throw new Error('SSL_KEY_PATH and SSL_CERT_PATH must be provided for HTTPS')
}

const app: Express = express()
const port = process.env.PORT || 3005

app.set('trust proxy', 1)

app.use(helmet())

app.use(
  cors({
    methods: ['GET', 'POST'],
    credentials: true,
  }),
)

app.set('SVS_SIGN_KEY', SVS_SIGN_KEY)
app.set('PAYMASTER_SIGNER_KEY', PAYMASTER_SIGNER_KEY)
app.set('PAYMASTER_ADDRESS', PAYMASTER_ADDRESS)
app.set('OPNVOTE_CONTRACT_ADDRESS', OPNVOTE_CONTRACT_ADDRESS)
app.set('CHAIN_ID', CHAIN_ID)
app.set('ENTRYPOINT_ADDRESS', ENTRYPOINT_ADDRESS)
app.set('ACCOUNT_IMPLEMENTATION_ADDRESS', ACCOUNT_IMPLEMENTATION_ADDRESS)
app.set('MAX_SPONSOR_COUNT', MAX_SPONSOR_COUNT)
if (BUNDLER_URL) app.set('BUNDLER_URL', BUNDLER_URL)

const provider = new ethers.JsonRpcProvider(RPC_PROVIDER)
app.set('rpcProvider', provider)

if (require.main === module) {
  if (SSL_KEY_PATH && SSL_CERT_PATH) {
    // Load HTTPS options
    const httpsOptions = {
      key: fs.readFileSync(SSL_KEY_PATH),
      cert: fs.readFileSync(SSL_CERT_PATH),
    }

    // Start HTTPS server
    https.createServer(httpsOptions, app).listen(port, () => {
      logger.info(`⚡️[server]: Server is running at ${SERVER_URL}`)
    })
  } else {
    http.createServer({}, app).listen(port, () => {
      logger.info(`⚡️[server]: Server is running at ${SERVER_URL}`)
    })
  }
}

// Load database
dataSource
  .initialize()
  .then(() => {
    app.use(express.json())

    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

    app.use('/api/votingTransaction', signRoutes)
    app.use('/api/userOp', sponsorRoutes)
    app.use('/api/forward', forwardRoutes)

    app.get('/', (_req, res) => {
      res.redirect('/api-docs')
    })
  })
  .catch(err => {
    logger.error('Error during Data Source initialization', err)
  })

export { app }
