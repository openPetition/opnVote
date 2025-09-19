import { Request, Response, Router } from 'express'
import { RegisterKeyService } from '../services/registerKeyService'
import { ApiResponse } from '../types/apiResponses'
import { logger } from '../utils/logger'
import { ethers } from 'ethers'
import { isValidHex } from 'votingsystem'

const router = Router()

const PRIVATE_KEY = process.env.PRIVATE_KEY
if (!PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY environment variable is required for register authentication')
}

const registerWallet = new ethers.Wallet(PRIVATE_KEY)
const AUTHORIZED_REGISTER_ADDRESS = registerWallet.address

/**
 * Verifies that the signature was created by the authorized admin
 */
function verifyAdminSignature(message: string, signature: string): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature)
    if (recoveredAddress.toLowerCase() !== AUTHORIZED_REGISTER_ADDRESS.toLowerCase()) {
      logger.warn(
        `Admin Register-Key insert request from unauthorized address: ${recoveredAddress}`,
      )
      return false
    }
    return true
  } catch (error) {
    logger.warn(`Invalid signature format in admin request: ${error}`)
    return false
  }
}

/**
 * @openapi
 * /api/admin/keys:
 *   post:
 *     summary: Insert register keys for an election
 *     description: Administrative endpoint to insert RSA register keys for a specific election. Authentication will be done via signature verification.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               electionId:
 *                 type: number
 *                 description: "The election ID to insert keys for"
 *                 example: 1
 *               N:
 *                 type: string
 *                 description: "RSA modulus N as string"
 *               D:
 *                 type: string
 *                 description: "RSA private exponent D as string"
 *               E:
 *                 type: string
 *                 description: "RSA public exponent E as string"
 *               NbitLength:
 *                 type: number
 *                 description: "Bit length of N"
 *                 example: 2048
 *               signature:
 *                 type: string
 *                 description: "Ethereum signature for authentication. Must sign message: 'Insert register key for election {electionId} with N={N}, D={D}, E={E}, NbitLength={NbitLength}'"
 *             required: [electionId, N, D, E, NbitLength, signature]
 *     responses:
 *       200:
 *         description: Register keys successfully inserted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Register keys successfully inserted for election 1"
 *                     electionId:
 *                       type: number
 *                       example: 1
 *                 error:
 *                   type: null
 *       400:
 *         description: Bad request - validation failed or keys already exist
 *       401:
 *         description: Unauthorized - invalid signature
 *       500:
 *         description: Internal server error
 */
router.post('/keys', async (req: Request, res: Response) => {
  try {
    const { electionId, N, D, E, NbitLength, signature } = req.body

    const message = `Insert register key for election ${electionId} with N=${N}, D=${D}, E=${E}, NbitLength=${NbitLength}`
    if (!verifyAdminSignature(message, signature)) {
      return res.status(401).json({
        data: null,
        error: 'Unauthorized: Invalid signature',
      } as ApiResponse<null>)
    }

    // Validate required fields
    if (!electionId || !N || !D || !E || !NbitLength) {
      return res.status(400).json({
        data: null,
        error: 'Missing required fields: electionId, N, D, E, NbitLength',
      } as ApiResponse<null>)
    }

    // Validate types
    if (typeof electionId !== 'number' || typeof NbitLength !== 'number') {
      return res.status(400).json({
        data: null,
        error: 'electionId and NbitLength must be numbers',
      } as ApiResponse<null>)
    }

    try {
      if (!isValidHex(N, false, false)) {
        throw new Error(`Invalid hex format for N: ${N}`)
      }
      if (!isValidHex(D, false, false)) {
        throw new Error(`Invalid hex format for D: ${D}`)
      }
      if (isValidHex(E)) {
        throw new Error(`E must be a decimal number, not hex: ${E}`)
      }

      // Sanity check: N and D must not be equal
      if (N.toLowerCase() === D.toLowerCase()) {
        throw new Error('N and D cannot be equal')
      }
    } catch (error: any) {
      return res.status(400).json({
        data: null,
        error: error.message,
      } as ApiResponse<null>)
    }

    const rsaParams = {
      N: BigInt(N),
      D: BigInt(D),
      e: BigInt(E),
      NbitLength: NbitLength,
    }

    await RegisterKeyService.storeKeys(electionId, rsaParams)

    logger.info(`Register keys successfully inserted for election ${electionId}`)

    return res.json({
      data: {
        message: `Register keys successfully inserted for election ${electionId}`,
        electionId: electionId,
      },
      error: null,
    } as ApiResponse<{ message: string; electionId: number }>)
  } catch (error: any) {
    logger.error(`Failed to insert register keys: ${error.message}`)

    if (error.message.includes('Key already exist')) {
      return res.status(400).json({
        data: null,
        error: error.message,
      } as ApiResponse<null>)
    }

    return res.status(500).json({
      data: null,
      error: 'Failed to insert register keys',
    } as ApiResponse<null>)
  }
})

export default router
