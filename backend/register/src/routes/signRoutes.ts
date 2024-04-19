import { Request, Response, Router } from 'express';
import { jwtTokenValidator } from '../validation/authvalidation';
import authenticateJWT from '../middleware/authenticateJWT';
import { checkElectionStatus } from '../middleware/checkElectionStatus';
import { blindedTokenValidationRules } from '../validation/ovTokenValidation';
import checkForExistingBlindedSignature from '../middleware/checkExistingBlindSignatures';
import { RSAParams, signToken, Signature, Token } from 'votingsystem';
import { BlindedSignature } from '../models/BlindedSignature';
import { dataSource } from '../database';
import { ApiResponse } from '../types/apiResponses';

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
  jwtTokenValidator(),                // Checks if JWT is present in Authorization header.
  authenticateJWT,                  // Checks if JWT is valid
  checkElectionStatus,              // Confirms that election status is Pending or Open
  blindedTokenValidationRules(),      // Checks if provided blinded Token format is corret
  checkForExistingBlindedSignature, // Confirms that user didnt receive a blinded Signature for this election
  async (req: Request, res: Response) => {

    try {

      if (!req.user) {
        // Should be Unreachable
        return res.status(401).json({
          data: null,
          error: 'Unauthorized'
        } as ApiResponse<null>);

      }

      const authHeader = req.headers.authorization;

      if (!authHeader) {
        // Should be Unreachable
        return res.status(401).json({
          data: null,
          error: 'Unauthorized: No Authorization header'
        } as ApiResponse<null>);
      }

      const registerSigner = req.app.locals.RegisterSigner as RSAParams;
      if (!registerSigner) {
        return res.status(500).json({
          data: null,
          error: 'RegisterSigner configuration not found'
        } as ApiResponse<null>);
      }


      // Sign Token
      const blindedToken = req.body.token as Token;
      const blindedSignature: Signature = signToken(blindedToken, registerSigner);

      // Store signed tokens in local database
      const { userID, electionID } = req.user;
      const jwtToken = authHeader.split(' ')[1];

      const signatureRecord = new BlindedSignature();
      signatureRecord.userID = userID;
      signatureRecord.electionID = electionID;
      signatureRecord.blindedToken = blindedToken.hexString;
      signatureRecord.blindedSignature = blindedSignature.hexString;
      signatureRecord.jwt = jwtToken

      const repository = dataSource.getRepository(BlindedSignature);
      await repository.save(signatureRecord);

      // Return signed Token
      res.json({
        data: {
          blindedSignature: signatureRecord.blindedSignature
        },
        error: null,
      } as ApiResponse<{ blindedSignature: string }>);

    }
    catch (error) {
      console.error('Error signing token:', error);
      res.status(500).json({
        data: null,
        error: 'Failed to process token'
      } as ApiResponse<null>);
    };
  })

export default router;
