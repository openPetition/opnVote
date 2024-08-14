import { Request, Response, Router } from 'express';
// import { jwtTokenValidator } from '../validation/authvalidation';
// import authenticateJWT from '../middleware/authenticateJWT';
// import { checkElectionStatus } from '../middleware/checkElectionStatus';
// import { blindedTokenValidationRules } from '../validation/ovTokenValidation';
// import checkForExistingBlindedSignature from '../middleware/checkExistingBlindSignatures';
// import { RSAParams, signToken, Signature, Token } from 'votingsystem';
// import { BlindedSignature } from '../models/BlindedSignature';
// import { dataSource } from '../database';
import { ApiResponse } from '../types/apiResponses';
import { EthSignature, Signature, VotingTransaction, signVotingTransaction, validateVotingTransaction } from 'votingsystem';
import { checkVoterSignature } from '../middleware/checkVoterSignature';
import { validateParameters } from '../middleware/validateParameters';
import { checkElectionStatus } from '../middleware/checkElectionStatus';
import { validateBlindSignature } from '../middleware/validateBlindSignature';
import checkForExistingSVSSignature from '../middleware/checkForExistingSVSSignature';
import { dataSource } from '../database';
import { VotingTransactionEntity } from '../models/VotingTransaction';
import { TransactionStatus } from '../types/transactionTypes';



const router = Router();
/**
 * @openapi
 * /api/votingTransaction/sign:
 *   post:
 *     summary: Validate and sign the voting votingTransaction.
 *     description: Validates the voting votingTransaction and signs it
 *     tags: [Voting]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               votingTransaction:
 *                 type: object
 *                 properties:
 *                   electionID:
 *                     type: number
 *                     description: "ID of the election."
 *                     example: 123
 *                   voterAddress:
 *                     type: string
 *                     description: "Ethereum address of the voter."
 *                     example: "0x1234567890abcdef1234567890abcdef12345678"
 *                   encryptedVote:
 *                     type: object
 *                     properties:
 *                       hexString:
 *                         type: string
 *                         description: "Hex string of the encrypted vote."
 *                         example: "0xabcdef..."
 *                   unblindedElectionToken:
 *                     type: object
 *                     properties:
 *                       hexString:
 *                         type: string
 *                         description: "Hex string of the unblinded election token."
 *                         example: "0x1...[130 characters]"
 *                       isMaster:
 *                         type: boolean
 *                         description: "Indicates if the token is a master token."
 *                         example: false
 *                       isBlinded:
 *                         type: boolean
 *                         description: "Indicates if the token is blinded."
 *                         example: false
 *                   unblindedSignature:
 *                     type: object
 *                     properties:
 *                       hexString:
 *                         type: string
 *                         description: "Hex string of the unblinded signature."
 *                         example: "0x2...[signed hex]"
 *                       isBlinded:
 *                         type: boolean
 *                         description: "Indicates if the signature is blinded."
 *                         example: false
 *                   svsSignature:
 *                     type: object
 *                     properties:
 *                       hexString:
 *                         type: string
 *                         description: "Hex string of the SVS signature."
 *                         example: "0x3...[signed hex]"
 *                       isBlinded:
 *                         type: boolean
 *                         description: "Indicates if the signature is blinded."
 *                         example: true
 *     responses:
 *       200:
 *         description: Transaction successfully signed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 signature:
 *                   type: object
 *                   properties:
 *                     hexString:
 *                       type: string
 *                       description: "Hex string of the signed transaction."
 *                       example: "0x4...[signed hex]"
 *                     isBlinded:
 *                       type: boolean
 *                       description: "Indicates if the signature is blinded."
 *                       example: true
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
 *       500:
 *         description: Internal server error due to configuration issues or database errors.
 */
//! todo: add unblinded token check (import from votingsystem?)
router.post('/sign',
    validateParameters, // checks if voting transaction and voter signature are set correctly
    checkVoterSignature, // checks if voting transaction has been signed correctly
    checkElectionStatus,  // Confirms that election status is Pending or Open
    validateBlindSignature, //Validates Blind Signature
    // checkForExistingSVSSignature, //! todo implement & test
    async (req: Request, res: Response) => {
        try {
            const votingTransaction = req.body.votingTransaction as VotingTransaction;

            if (!votingTransaction) {
                return res.status(401).json({
                    data: null,
                    error: 'Unauthorized'
                } as ApiResponse<null>);
            }

            // Sign Token
            const signingKey = req.app.get('SVS_SIGN_KEY');
            if (!signingKey) {
                return res.status(500).json({
                    data: null,
                    error: 'Signing key not configured'
                } as ApiResponse<null>);
            }

            const svsSignature: EthSignature = await signVotingTransaction(votingTransaction, signingKey);


            const signedTransaction = new VotingTransactionEntity();
            signedTransaction.electionID = votingTransaction.electionID
            signedTransaction.encryptedVote = votingTransaction.encryptedVote.hexString
            signedTransaction.rateLimited = false
            signedTransaction.svsSignature = svsSignature.hexString
            signedTransaction.txStatus = TransactionStatus.WAITING
            signedTransaction.txHash = null
            signedTransaction.unblindedElectionToken = votingTransaction.unblindedElectionToken.hexString.toLowerCase()
            signedTransaction.unblindedSignature = votingTransaction.unblindedSignature.hexString.toLowerCase()
            signedTransaction.voterAddress = votingTransaction.voterAddress



            // const repository = dataSource.getRepository(VotingTransactionEntity);
            // await repository.save(signedTransaction);

            return res.status(200).json({
                data: svsSignature,
                error: null
            } as ApiResponse<Signature>);


        }
        catch (error) {
            console.error('Error signing token:', error);
            res.status(500).json({
                data: null,
                error: 'Failed to sign Transaction. Error: ' + error
            } as ApiResponse<null>);
        };
    })

export default router;
