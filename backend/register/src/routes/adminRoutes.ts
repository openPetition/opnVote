import { Request, Response, Router } from 'express'
import { RegisterKeyService } from '../services/registerKeyService'
import { ApiResponse } from '../types/apiResponses'
import { logger } from '../utils/logger'
import { ethers } from 'ethers'
import { validateBlsParams } from 'votingsystem'

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
 *     description: Administrative endpoint to insert BLS12-381 register keys for a specific election. Authentication will be done via signature verification.
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
 *               pk:
 *                 type: string
 *                 description: "BLS12-381 public key (uncompressed G2 point) as hex string, '0x'-prefixed"
 *               sk:
 *                 type: string
 *                 description: "BLS12-381 private scalar as decimal string or 0x-prefixed hex string"
 *               signature:
 *                 type: string
 *                 description: "Ethereum signature for authentication. Must sign message: 'Insert register key for election {electionId} with pk={pk}'."
 *             required: [electionId, pk, sk, signature]
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
    const { electionId, pk, sk, signature } = req.body

    const message = `Insert register key for election ${electionId} with pk=${pk}`
    if (!verifyAdminSignature(message, signature)) {
      return res.status(401).json({
        data: null,
        error: 'Unauthorized: Invalid signature',
      } as ApiResponse<null>)
    }

    // Validate required fields
    if (!electionId || !pk || !sk) {
      return res.status(400).json({
        data: null,
        error: 'Missing required fields: electionId, pk, sk',
      } as ApiResponse<null>)
    }

    // Validate types
    if (typeof electionId !== 'number') {
      return res.status(400).json({
        data: null,
        error: 'electionId must be a number',
      } as ApiResponse<null>)
    }

    let blsParams
    try {
      blsParams = { pk, sk: BigInt(sk) }
      validateBlsParams(blsParams)
    } catch (error: any) {
      return res.status(400).json({
        data: null,
        error: `Invalid BLS parameters: ${error.message}`,
      } as ApiResponse<null>)
    }

    await RegisterKeyService.storeKeys(electionId, blsParams)

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
