import dotenv from 'dotenv';
dotenv.config();

import 'reflect-metadata';
import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { dataSource } from './database';
import signRoutes from './routes/signRoutes';
import gelatoRoutes from './routes/gelatoRoutes';
import { GelatoRelay } from "@gelatonetwork/relay-sdk";
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swaggerConfig';
import https from 'https';
import fs from 'fs'
import http from 'http';
import { startGelatoWorker } from './workers/gelatoWorker';
import { ethers } from 'ethers';
import { logger } from './utils/logger';
import { getEnvVar } from './utils/utils';

require('dotenv').config();

const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;


const SERVER_URL = getEnvVar<string>('SERVER_URL', 'string');
const SVS_SIGN_KEY = getEnvVar<string>('SVS_SIGN_KEY', 'string');
const GELATO_SPONSOR_API_KEY = getEnvVar<string>('GELATO_SPONSOR_API_KEY', 'string');
const OPNVOTE_CONTRACT_ADDRESS = getEnvVar<string>('OPNVOTE_CONTRACT_ADDRESS', 'string');
const GELATO_MAX_FORWARDS = getEnvVar<number>('GELATO_MAX_FORWARDS', 'number');
const CHAIN_ID = getEnvVar<number>('CHAIN_ID', 'number');
const RPC_PROVIDER = getEnvVar<string>('RPC_PROVIDER', 'string');
const GELATO_USE_QUEUE = getEnvVar<string>('GELATO_USE_QUEUE', 'string');



if ((SSL_KEY_PATH && !SSL_CERT_PATH) || (!SSL_KEY_PATH && SSL_CERT_PATH)) {
  throw new Error('SSL_KEY_PATH and SSL_CERT_PATH must be provided for HTTPS');
}

if (GELATO_USE_QUEUE.toLowerCase() !== 'true' && GELATO_USE_QUEUE.toLowerCase() !== 'false') {
  throw new Error('GELATO_USE_QUEUE must be "true" or "false"');
}

const app: Express = express();
const port = process.env.PORT || 3005;

app.use(helmet());

app.use(cors({
  methods: ['GET', 'POST'],
  credentials: true,
}));


app.set('SVS_SIGN_KEY', SVS_SIGN_KEY);
app.set('GELATO_SPONSOR_API_KEY', GELATO_SPONSOR_API_KEY);
app.set('OPNVOTE_CONTRACT_ADDRESS', OPNVOTE_CONTRACT_ADDRESS);
app.set('GELATO_MAX_FORWARDS', GELATO_MAX_FORWARDS);
app.set('CHAIN_ID', CHAIN_ID);

const gelatoRelay = new GelatoRelay();
app.set('gelatoRelay', gelatoRelay);
const provider = new ethers.JsonRpcProvider(RPC_PROVIDER);
app.set('rpcProvider', provider);

if (GELATO_USE_QUEUE.toLowerCase() === "true") {
  app.set('GELATO_USE_QUEUE', true);
} else if (GELATO_USE_QUEUE.toLowerCase() === "false") {
  app.set('GELATO_USE_QUEUE', false);
} else {
  throw new Error('GELATO_USE_QUEUE must be "true" or "false"');
}

if (require.main === module) {

  if (SSL_KEY_PATH && SSL_CERT_PATH) {
    // Load HTTPS options
    const httpsOptions = {
      key: fs.readFileSync(SSL_KEY_PATH),
      cert: fs.readFileSync(SSL_CERT_PATH)
    };

    // Start HTTPS server
    https.createServer(httpsOptions, app).listen(port, () => {
      logger.info(`⚡️[server]: Server is running at ${SERVER_URL}`);
    });
  } else {
    http.createServer({}, app).listen(port, () => {
      logger.info(`⚡️[server]: Server is running at ${SERVER_URL}`);
    });
  }
}



// Load database
dataSource.initialize().then(() => {

  app.use(express.json());

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use('/api/votingTransaction', signRoutes);
  app.use('/api/gelato', gelatoRoutes);

  app.get('/', (req, res) => {
    res.redirect('/api-docs');
  });

  startGelatoWorker();
}).catch((err) => {
  logger.error("Error during Data Source initialization", err);
});

export { app };