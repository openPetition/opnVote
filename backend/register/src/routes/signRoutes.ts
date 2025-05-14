import { Request, Response, Router } from 'express';
import { jwtTokenValidator } from '../validation/authvalidation';
import authenticateJWT from '../middleware/authenticateJWT';
import { checkElectionStatus } from '../middleware/checkElectionStatus';
import { blindedTokenValidationRules } from '../validation/ovTokenValidation';
import checkForExistingBlindedSignature, { unauthenticatedCheckForExistingBlindSignature } from '../middleware/checkExistingBlindSignatures';
import { signToken, Token } from 'votingsystem';
import { BlindedSignature } from '../models/BlindedSignature';
import { dataSource } from '../database';
import { ApiResponse } from '../types/apiResponses';
import { RegisterKeyService } from '../services/registerKeyService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @openapi
 * /api/sign:
 *   post:
 *     summary: Validate if user is eligible for registration and sign blinded Token.
 *     description: Registration for election through this route. Validates the JWT, checks election status, ensures correct token format, checks for prior signatures, and signs the token if eligible.
 *     tags: [Registration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: object
 *                 properties:
 *                   hexString:
 *                     type: string
 *                     description: "Hex string of the token, must be 130 characters long and start with 0x1."
 *                     example: "0x1...[130 characters]"
 *                   isMaster:
 *                     type: boolean
 *                     description: "Indicates if the token is a master token, which cannot be signed."
 *                     example: false
 *                   isBlinded:
 *                     type: boolean
 *                     description: "Indicates if the token is blinded, which must be true for signing."
 *                     example: true
 *     responses:
 *       200:
 *         description: Token successfully signed and returned.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 blindedSignature:
 *                   type: string
 *                   description: "Hex string of the signed blinded token."
 *                   example: "0x2...[signed hex]"
 *       400:
 *         description: Parameter validation failed or user has already registered a different token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Parameter validation failed or already registered."
 *       401:
 *         description: Unauthorized - No valid JWT, no authorization header, or missing election ID.
 *       500:
 *         description: Internal server error due to configuration issues or database errors.
 */

router.post('/',
  blindedTokenValidationRules(),      // Checks if provided blinded Token format is corret
  unauthenticatedCheckForExistingBlindSignature, // Check if token exists in DB (no JWT required)
  jwtTokenValidator(),                // Checks if JWT is present in Authorization header.
  authenticateJWT,                  // Checks if JWT is valid
  checkElectionStatus,              // Confirms that election status is Pending or Open
  checkForExistingBlindedSignature, // Confirms that user didnt receive a blinded Signature for this election
  async (req: Request, res: Response) => {
    let startTime: number = Date.now();
    try {

      const { userID, electionID } = req.user!;
      const authHeader = req.headers.authorization!;
      const blindedToken = req.body.token as Token;

      logger.debug(`Processing registration for user ${userID} in election ${electionID}`);
      startTime = Date.now();

      const registerSigner = await RegisterKeyService.getKeysByElectionId(electionID);
      if (!registerSigner) {
        throw new Error(`No register keys configured for election ${electionID}`);
      }

      const blindedSignature = signToken(blindedToken, registerSigner);
      const jwtToken = authHeader.split(' ')[1];


      try {
        await dataSource.createQueryBuilder()
          .insert()
          .into(BlindedSignature)
          .values({
            userID,
            electionID,
            blindedToken: blindedToken.hexString.toLowerCase(),
            blindedSignature: blindedSignature.hexString.toLowerCase(),
            jwt: jwtToken,
            onchainStatus: 'pending',
            txHash: null,
            batchID: null,
          })
          .execute();
        return res.json({
          data: {
            blindedSignature: blindedSignature.hexString.toLowerCase()
          },
          error: null,
        } as ApiResponse<{ blindedSignature: string }>);
      } catch (e: any) {
        if (e.code === 'ER_DUP_ENTRY') {
          // fetch existing row for idempotent retry
          const existing = await dataSource.getRepository(BlindedSignature)
            .findOneBy({ userID, electionID });
          if (existing!.blindedToken.toLowerCase() === blindedToken.hexString.toLowerCase()) {
            return res.json({ data: { message: 'Existing blinded signature found.', blindedSignature: existing!.blindedSignature.toLowerCase() }, error: null });
          }
          return res.status(400).json({ data: null, error: 'Already registered with different token' });
        }
        logger.error(e);
        return res.status(500).json({ data: null, error: 'Failed to process token' });
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      if (duration > 500) {
        logger.warn(`[SLOW] Error in registration process after ${duration}ms: ${error}`);
      } else {
        logger.debug(`Error in registration process after ${duration}ms: ${error}`);
      }

      return res.status(500).json({
        data: null,
        error: 'Failed to process token'
      } as ApiResponse<null>);
    } finally {
      const duration = Date.now() - startTime;
      if (duration > 500) {
        logger.warn(`[SLOW] Total DB transaction time: ${duration}ms`);
      } else {
        logger.debug(`Total DB transaction time: ${duration}ms`);
      }

    }
  })

export default router;
