import dotenv from 'dotenv'
dotenv.config()

import 'reflect-metadata'
import express, { Express } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { dataSource } from './database'
import signRoutes from './routes/signRoutes'
import authRoutes from './routes/authRoutes'
import swaggerUi from 'swagger-ui-express'
import swaggerSpec from './config/swaggerConfig'
import https from 'https'
import http from 'http'
import { initializeRegisterKeys } from './init/initializeRegisterKeys'

const AP_JWT_PUBLIC_KEY_PATH = process.env.AP_JWT_PUBLIC_KEY_PATH
const SERVER_URL = process.env.SERVER_URL
const SSL_KEY_PATH = process.env.SSL_KEY_PATH
const SSL_CERT_PATH = process.env.SSL_CERT_PATH

if (!AP_JWT_PUBLIC_KEY_PATH) {
  throw new Error('AP_JWT_PUBLIC_KEY_PATH is not defined in the environment variables')
}

if (!SERVER_URL) {
  throw new Error('SERVER_URL is not defined in the environment variables')
}

if ((SSL_KEY_PATH && !SSL_CERT_PATH) || (!SSL_KEY_PATH && SSL_CERT_PATH)) {
  throw new Error('SSL_KEY_PATH and SSL_CERT_PATH must be provided for HTTPS')
}

const app: Express = express()
const port = process.env.PORT || 3004

app.use(helmet())

app.use(
  cors({
    methods: ['GET', 'POST'],
    credentials: true,
  }),
)

// Load and set AP Pub Key
const AP_JWT_PUBLIC_KEY = fs.readFileSync(path.resolve(AP_JWT_PUBLIC_KEY_PATH), 'utf8')
app.set('AP_JWT_PUBLIC_KEY', AP_JWT_PUBLIC_KEY)

if (SSL_KEY_PATH && SSL_CERT_PATH) {
  // Load HTTPS options
  const httpsOptions = {
    key: fs.readFileSync(SSL_KEY_PATH),
    cert: fs.readFileSync(SSL_CERT_PATH),
  }

  // Start HTTPS server
  https.createServer(httpsOptions, app).listen(port, () => {
    console.log(`⚡️[server]: Server is running at ${SERVER_URL}`)
  })
} else {
  http.createServer({}, app).listen(port, () => {
    console.log(`⚡️[server]: Server is running at ${SERVER_URL}`)
  })
}

// Load database
dataSource
  .initialize()
  .then(async () => {
    await initializeRegisterKeys() // initialize register keys from .env

    app.use(express.json())

    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

    app.use('/api/auth', authRoutes)
    app.use('/api/sign', signRoutes)
  })
  .catch(err => {
    console.error('Error during Data Source initialization', err)
  })
