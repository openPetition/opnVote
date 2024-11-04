import express, { Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import fetch from 'node-fetch';
import { ethers } from 'ethers';
import FormData from 'form-data';
import rateLimit from 'express-rate-limit';
import { allowedAuthors } from './admins';
import cors from 'cors';
import { body, validationResult } from 'express-validator';
import swaggerSpec from './swaggerConfig';
import helmet from 'helmet';
import http from 'http';
import https from 'https';
import fs from 'fs'

require('dotenv').config();
const IPFS_API = process.env.IPFS_API
const SSL_KEY_PATH = process.env.SSL_KEY_PATH
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;
const SERVER_URL = process.env.SERVER_URL;

if (!IPFS_API || !SERVER_URL) {
  throw new Error("Missing required environment variables");
}

if ((SSL_KEY_PATH && !SSL_CERT_PATH) || (!SSL_KEY_PATH && SSL_CERT_PATH)) {
  throw new Error('SSL_KEY_PATH and SSL_CERT_PATH must be provided for HTTPS');
}

const app = express();
const PORT = process.env.PORT || 3001;


app.use(cors());
app.use(helmet());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(express.json());
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25
});
app.use("/pinElectionData", apiLimiter);

if (SSL_KEY_PATH && SSL_CERT_PATH) {
  const httpsOptions = {
    key: fs.readFileSync(SSL_KEY_PATH),
    cert: fs.readFileSync(SSL_CERT_PATH)
  };

  https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`Server listening at ${SERVER_URL}`);
  });
} else {
  http.createServer({}, app).listen(PORT, () => {
    console.log(`Server listening at ${SERVER_URL}`);
  });
}

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Internal Server Error');
});



/**
 * @swagger
 * /pinElectionData:
 *   post:
 *     summary: Pins election data to IPFS
 *     description: Verifies if the signature is from an authorized admin and pins the provided election data to IPFS.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PinElectionDataRequest'
 *     responses:
 *       200:
 *         description: Election data successfully pinned to IPFS. Returns the CID of the pinned content.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 cid:
 *                   type: string
 *       400:
 *         description: Missing or invalid election data or signature.
 *       500:
 *         description: Server error or unauthorized admin signature.
 */

interface ElectionData {
  title: string;
  description: string;
  summary: string;
  ballot: string[];
}
app.post('/pinElectionData', [
  body('electionData.title').isString(),
  body('electionData.description').isString(),
  body('electionData.summary').isString(),
  body('electionData.ballot').isArray(),
  body('signature').isString(),
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { electionData, signature } = req.body;

  if (!electionData || !signature) {
    return res.status(400).send("Missing election data or signature");
  }

  try {
    const hash = await uploadAndPinJSONData(electionData, signature);
    res.json({ success: true, message: "Election data pinned successfully", cid: hash });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error('Error verifying admin signature', errorMessage);

    if (errorMessage === 'Unauthorized') {
      return res.status(400).send('Unauthorized: Signer is not an authorized admin');
    }

    res.status(500).send("An internal error occurred, please try again later.");
  }

});


/**
 * Uploads and pins JSON data to IPFS after signature validation.
 *
 * @param {ElectionData} electionData - The election data to be pinned, containing description, summary, and ballot.
 * @param {string} signature - Ethereum signature used to verify that the electionData is signed by an authorized admin.
 * @returns {Promise<string>} The hash of the pinned data on IPFS.
 * @throws {Error} Throws an error if the signature verification fails, the sender is not an authorized admin, or the IPFS add operation fails.
 */
async function uploadAndPinJSONData(electionData: ElectionData, signature: string): Promise<string> {

  try {
    const message = JSON.stringify(electionData);

    const signerAddress = ethers.verifyMessage(message, signature).toLowerCase();
    const admin = allowedAuthors.find(admin => admin.walletAddress.toLowerCase() === signerAddress);

    if (!admin) {
      throw new Error("Unauthorized");
    }

    const dataWithAuthor = { ...electionData, author: admin.name };
    const formData = new FormData();
    const jsonData = JSON.stringify(dataWithAuthor);
    formData.append('file', Buffer.from(jsonData), { filename: 'electionData.json', contentType: 'application/json' });

    const addResponse = await fetch(`${IPFS_API}/add`, {
      method: 'POST',
      body: formData,
    });

    if (!addResponse.ok) {
      throw new Error(`IPFS add failed: ${addResponse.statusText}`);
    }

    const addResult = await addResponse.json() as { Hash: string };
    return addResult.Hash;
  } catch (error) {
    throw error;
  }
}
