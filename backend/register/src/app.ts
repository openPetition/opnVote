import dotenv from 'dotenv';
dotenv.config();

import 'reflect-metadata';
import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { dataSource } from './database';
import { RSAParams } from 'votingsystem';
import signRoutes from './routes/signRoutes';
import authRoutes from './routes/authRoutes';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swaggerConfig';

if (!process.env.REGISTER_N || !process.env.REGISTER_D || !process.env.REGISTER_N_LENGTH) { throw new Error("RSA Parameters not set") }
const REGISTER_N = BigInt(process.env.REGISTER_N);
const REGISTER_D = BigInt(process.env.REGISTER_D);
const REGISTER_N_LENGTH = parseInt(process.env.REGISTER_N_LENGTH, 10);
const AP_JWT_PUBLIC_KEY_PATH = process.env.AP_JWT_PUBLIC_KEY_PATH;

if (!AP_JWT_PUBLIC_KEY_PATH) {
  throw new Error('AP_JWT_PUBLIC_KEY_PATH is not defined in the environment variables');
}

const RegisterSigner: RSAParams = {
  N: REGISTER_N,
  D: REGISTER_D,
  NbitLength: REGISTER_N_LENGTH
};

const app: Express = express();
const port = process.env.PORT || 3004;

app.use(helmet());

app.use(cors({
  methods: ['GET', 'POST'],
  credentials: true,
}));


app.locals.RegisterSigner = RegisterSigner;

// Load and Set AP Pub Key
const AP_JWT_PUBLIC_KEY = fs.readFileSync(path.resolve(AP_JWT_PUBLIC_KEY_PATH), 'utf8');
app.set('AP_JWT_PUBLIC_KEY', AP_JWT_PUBLIC_KEY);

// Load database
dataSource.initialize().then(() => {

  app.use(express.json());

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use('/api/auth', authRoutes);
  app.use('/api/sign', signRoutes);

  app.listen(port, () => {
    console.log(`⚡️[server]: Server is running at https://localhost:${port}`);
  });

}).catch((err) => {
  console.error("Error during Data Source initialization", err);
});