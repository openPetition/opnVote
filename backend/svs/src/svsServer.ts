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

require('dotenv').config();
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;

const SERVER_URL = process.env.SERVER_URL
const SVS_SIGN_KEY = process.env.SVS_SIGN_KEY;
const gelatoSponsorApiKey = process.env.GELATO_SPONSOR_API_KEY;


if (!SERVER_URL) {
  throw new Error('SERVER_URL is not defined in the environment variables');
}

if ((SSL_KEY_PATH && !SSL_CERT_PATH) || (!SSL_KEY_PATH && SSL_CERT_PATH)) {
  throw new Error('SSL_KEY_PATH and SSL_CERT_PATH must be provided for HTTPS');
}

if (!SVS_SIGN_KEY) {
  throw new Error('SVS_SIGN_KEY is not set in the environment variables.');
}

if (!gelatoSponsorApiKey) {
  throw new Error('Error: GELATO_SPONSOR_API_KEY is not set in the environment variables.');
}


const app: Express = express();
const port = process.env.PORT || 3005;

app.use(helmet());

app.use(cors({
  methods: ['GET', 'POST'],
  credentials: true,
}));


app.set('SVS_SIGN_KEY', SVS_SIGN_KEY);
app.set('GELATO_SPONSOR_API_KEY', gelatoSponsorApiKey);

const gelatoRelay = new GelatoRelay();

app.set('gelatoRelay', gelatoRelay);


if (SSL_KEY_PATH && SSL_CERT_PATH) {
  // Load HTTPS options
  const httpsOptions = {
    key: fs.readFileSync(SSL_KEY_PATH),
    cert: fs.readFileSync(SSL_CERT_PATH)
  };

  // Start HTTPS server
  https.createServer(httpsOptions, app).listen(port, () => {
    console.log(`⚡️[server]: Server is running at ${SERVER_URL}`);
  });
} else {
  http.createServer({}, app).listen(port, () => {
    console.log(`⚡️[server]: Server is running at ${SERVER_URL}`);
  });
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

}).catch((err) => {
  console.error("Error during Data Source initialization", err);
});