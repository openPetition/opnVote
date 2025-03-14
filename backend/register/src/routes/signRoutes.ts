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
    const queryRunner = dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const { userID, electionID } = req.user!;
      const authHeader = req.headers.authorization!;
      const blindedToken = req.body.token as Token;

      // Re-check for existing signature with lock
      const repository = queryRunner.manager.getRepository(BlindedSignature);
      const existingSignature = await repository.findOne({
        where: {
          userID: userID,
          electionID: electionID,
        },
        lock: { mode: 'pessimistic_write' }
      });

      if (existingSignature) {
        // If same token, return existing signature
        if (existingSignature.blindedToken.toLowerCase() === blindedToken.hexString.toLowerCase()) {
          return res.json({
            data: {
              message: 'Existing blinded signature found.',
              blindedSignature: existingSignature.blindedSignature.toLowerCase()
            },
            error: null,
          } as ApiResponse<{ blindedSignature: string }>);
        }

        return res.status(400).json({
          data: null,
          error: 'Already registered with different token'
        } as ApiResponse<null>);
      }

      const registerSigner = await RegisterKeyService.getKeysByElectionId(electionID);
      if (!registerSigner) {
        throw new Error(`No register keys configured for election ${electionID}`);
      }


      const blindedSignature = signToken(blindedToken, registerSigner);
      const jwtToken = authHeader.split(' ')[1];

      const signatureRecord = new BlindedSignature();
      signatureRecord.userID = userID;
      signatureRecord.electionID = electionID;
      signatureRecord.blindedToken = blindedToken.hexString.toLowerCase();
      signatureRecord.blindedSignature = blindedSignature.hexString.toLowerCase();
      signatureRecord.jwt = jwtToken;
      signatureRecord.txHash = null;
      signatureRecord.onchainStatus = 'pending';
      signatureRecord.batchID = null;

      await repository.save(signatureRecord);
      await queryRunner.commitTransaction();

      // Return signed Token
      res.json({
        data: {
          blindedSignature: signatureRecord.blindedSignature.toLowerCase()
        },
        error: null,
      } as ApiResponse<{ blindedSignature: string }>);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Error signing token:', error);
      return res.status(500).json({
        data: null,
        error: 'Failed to process token'
      } as ApiResponse<null>);
    } finally {
      await queryRunner.release();
    }
  })

export default router;
