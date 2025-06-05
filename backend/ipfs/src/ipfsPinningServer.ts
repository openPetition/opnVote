import express, { Request, Response } from 'express'
import swaggerUi from 'swagger-ui-express'
import fetch from 'node-fetch'
import { ethers } from 'ethers'
import FormData from 'form-data'
import rateLimit from 'express-rate-limit'
import { allowedAuthors } from './admins'
import cors from 'cors'
import { body, validationResult } from 'express-validator'
import swaggerSpec from './swaggerConfig'
import helmet from 'helmet'
import http from 'http'
import https from 'https'
import fs from 'fs'

require('dotenv').config()
const IPFS_API = process.env.IPFS_API
const SSL_KEY_PATH = process.env.SSL_KEY_PATH
const SSL_CERT_PATH = process.env.SSL_CERT_PATH
const SERVER_URL = process.env.SERVER_URL

if (!IPFS_API || !SERVER_URL) {
  throw new Error('Missing required environment variables')
}

if ((SSL_KEY_PATH && !SSL_CERT_PATH) || (!SSL_KEY_PATH && SSL_CERT_PATH)) {
  throw new Error('SSL_KEY_PATH and SSL_CERT_PATH must be provided for HTTPS')
}

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(helmet())

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.use(express.json())
app.get('/', (req, res) => {
  res.redirect('/api-docs')
})
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
  next()
})
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
})
app.use('/pinElectionData', apiLimiter)

if (SSL_KEY_PATH && SSL_CERT_PATH) {
  const httpsOptions = {
    key: fs.readFileSync(SSL_KEY_PATH),
    cert: fs.readFileSync(SSL_CERT_PATH),
  }

  https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`Server listening at ${SERVER_URL}`)
  })
} else {
  http.createServer({}, app).listen(PORT, () => {
    console.log(`Server listening at ${SERVER_URL}`)
  })
}

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).send('Internal Server Error')
})

/**
 * @swagger
 * components:
 *   schemas:
 *     Question:
 *       type: object
 *       required:
 *         - text
 *         - imageUrl
 *       properties:
 *         text:
 *           type: string
 *           description: The text of the question
 *         imageUrl:
 *           type: string
 *           description: URL of the question's image
 *     ElectionData:
 *       type: object
 *       required:
 *         - title
 *         - headerImage
 *         - description
 *         - summary
 *         - questions
 *       properties:
 *         title:
 *           type: string
 *           description: Title of the election
 *         headerImage:
 *           type: object
 *           properties:
 *             large:
 *               type: string
 *               description: Large header image URL for desktop
 *             small:
 *               type: string
 *               description: Small header image URL for mobile
 *         description:
 *           type: string
 *           description: Detailed description of the election
 *         summary:
 *           type: string
 *           description: Brief summary of the election
 *         questions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Question'
 *         backLink:
 *           type: string
 *           description: Backlink to the election coordinator
 *         registrationStartTime:
 *           type: integer
 *           description: Unix timestamp for when registration starts
 *         registrationEndTime:
 *           type: integer
 *           description: Unix timestamp for when registration ends
 *     PinElectionDataRequest:
 *       type: object
 *       required:
 *         - electionData
 *         - signature
 *       properties:
 *         electionData:
 *           $ref: '#/components/schemas/ElectionData'
 *         signature:
 *           type: string
 *           description: Ethereum signature of the election data
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

interface Question {
  text: string
  imageUrl: string
}

interface ElectionData {
  title: string
  headerImage: {
    large: string
    small: string
  }
  description: string
  summary: string
  questions: Question[]
  backLink: string
  registrationStartTime: number
  registrationEndTime: number
}

app.post(
  '/pinElectionData',
  [
    body('electionData.title').isString(),
    body('electionData.headerImage').isObject(),
    body('electionData.headerImage.large').isString(),
    body('electionData.headerImage.small').isString(),
    body('electionData.description').isString(),
    body('electionData.summary').isString(),
    body('electionData.questions').isArray(),
    body('electionData.questions.*.text').isString(),
    body('electionData.questions.*.imageUrl').isString(),
    body('electionData.backLink').isString(),
    body('electionData.registrationStartTime')
      .isNumeric()
      .custom(value => {
        const timestamp = parseInt(value)
        const minTimestamp = new Date('2020-01-01').getTime() / 1000 // Jan 1, 2020
        const maxTimestamp = new Date('2099-12-31').getTime() / 1000 // Dec 31, 2099
        if (timestamp < minTimestamp || timestamp > maxTimestamp) {
          throw new Error(
            'Registration start time must be a valid Unix timestamp between 2020 and 2099',
          )
        }
        return true
      }),
    body('electionData.registrationEndTime')
      .isNumeric()
      .custom(value => {
        const timestamp = parseInt(value)
        const minTimestamp = new Date('2020-01-01').getTime() / 1000 // Jan 1, 2020
        const maxTimestamp = new Date('2099-12-31').getTime() / 1000 // Dec 31, 2099
        if (timestamp < minTimestamp || timestamp > maxTimestamp) {
          throw new Error(
            'Registration end time must be a valid Unix timestamp between 2020 and 2099',
          )
        }
        return true
      })
      .custom((value, { req }) => {
        const endTime = parseInt(value)
        const startTime = parseInt(req.body.electionData.registrationStartTime)
        if (endTime <= startTime) {
          throw new Error('Registration end time must be after registration start time')
        }
        return true
      }),
    body('signature').isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }
    const { electionData, signature } = req.body

    if (!electionData || !signature) {
      return res.status(400).send('Missing election data or signature')
    }

    const forbiddenFields = ['author', 'authorWalletAddress', 'startTime', 'endTime']
    const forbiddenFieldsLower = forbiddenFields.map(field => field.toLowerCase())

    const providedForbiddenFields = Object.keys(electionData).filter(key =>
      forbiddenFieldsLower.includes(key.toLowerCase()),
    )

    if (providedForbiddenFields.length > 0) {
      return res.status(400).json({
        error: `The following fields are not allowed in the request: ${providedForbiddenFields.join(
          ', ',
        )}. These fields are added automatically and are not part of the schema.`,
      })
    }

    try {
      const hash = await uploadAndPinJSONData(electionData, signature)
      res.json({ success: true, message: 'Election data pinned successfully', cid: hash })
    } catch (error) {
      const errorMessage = (error as Error).message
      console.error('Error verifying admin signature: ' + errorMessage)

      if (errorMessage === 'Unauthorized') {
        return res.status(400).send('Unauthorized: Signer is not an authorized admin')
      }

      res.status(500).send('An internal error occurred, please try again later.')
    }
  },
)

/**
 * Uploads and pins JSON data to IPFS after signature validation.
 *
 * @param {ElectionData} electionData - The election data to be pinned, containing description, summary, and questions.
 * @param {string} signature - Ethereum signature used to verify that the electionData is signed by an authorized admin.
 * @returns {Promise<string>} The hash of the pinned data on IPFS.
 * @throws {Error} Throws an error if the signature verification fails, the sender is not an authorized admin, or the IPFS add operation fails.
 */
async function uploadAndPinJSONData(
  electionData: ElectionData,
  signature: string,
): Promise<string> {
  try {
    const message = JSON.stringify(electionData)
    const signerAddress = ethers.verifyMessage(message, signature).toLowerCase()
    const admin = allowedAuthors.find(admin => admin.walletAddress.toLowerCase() === signerAddress)

    if (!admin) {
      throw new Error('Unauthorized')
    }

    const dataWithAuthor = {
      ...electionData,
      author: admin.name,
      authorWalletAddress: admin.walletAddress,
    }
    const formData = new FormData()
    const jsonData = JSON.stringify(dataWithAuthor)
    formData.append('file', Buffer.from(jsonData), {
      filename: 'electionData.json',
      contentType: 'application/json',
    })

    try {
      const addResponse = await fetch(`${IPFS_API}/add`, {
        method: 'POST',
        body: formData,
      })

      if (!addResponse.ok) {
        throw new Error(`IPFS add failed: ${addResponse.statusText}`)
      }

      const addResult = (await addResponse.json()) as { Hash: string }
      return addResult.Hash
    } catch (fetchError) {
      console.error('IPFS Connection Error:', fetchError)
      throw new Error(
        `Cannot connect to IPFS at ${IPFS_API}. Please ensure IPFS daemon is running)`,
      )
    }
  } catch (error) {
    console.error('Error in uploadAndPinJSONData:', error)
    throw error
  }
}
