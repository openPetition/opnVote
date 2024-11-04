import { Request, Response, Router } from 'express';
import { ApiResponse } from '../types/apiResponses';
import { EthSignature, VotingTransaction, normalizeEthAddress, normalizeHexString, signVotingTransaction, validateEthSignature } from 'votingsystem';
import { checkVoterSignature } from '../middleware/checkVoterSignature';
import { validateParameters } from '../middleware/validateParameters';
import { checkElectionStatus } from '../middleware/checkElectionStatus';
import { validateBlindSignature } from '../middleware/validateBlindSignature';
import { checkForExistingSVSSignature } from '../middleware/checkForExistingSVSSignature';
import { dataSource } from '../database';
import { VotingTransactionEntity } from '../models/VotingTransaction';
import { checkVoterHasNotVoted } from '../middleware/checkVoterHasNotVoted';
import { logger } from '../utils/logger';



const router = Router();
/**
 * @openapi
 * /api/votingTransaction/sign:
 *   post:
 *     summary: Sign a voting transaction
 *     description: Validates and signs a voting transaction, ensuring the voter hasn't already voted and the election is still open.
 *     tags: [Voting]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               votingTransaction:
 *                 $ref: '#/components/schemas/VotingTransaction'
 *               voterSignature:
 *                 $ref: '#/components/schemas/EthSignature'
 *     responses:
 *       200:
 *         description: Successfully signed the voting transaction
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Bad request (e.g., invalid parameters, voter has already voted)
 *       401:
 *         description: Unauthorized (e.g., invalid voter signature)
 *       403:
 *         description: Forbidden (e.g., election is closed)
 *       500:
 *         description: Internal server error
 */
router.post('/sign',
    validateParameters,           // Validates the structure and format of the request parameters
    checkVoterSignature,          // Verifies that the voting transaction is correctly signed by the voter
    checkElectionStatus,          // Ensures that the election is still open for voting
    validateBlindSignature,       // Validates the blind signature from the register
    checkForExistingSVSSignature, // Checks if an SVS signature already exists for this transaction
    checkVoterHasNotVoted,        // Verifies that the voter hasn't already cast a vote in this election
    async (req: Request, res: Response) => {
        try {
            const votingTransaction = req.body.votingTransaction as VotingTransaction;
            if (!votingTransaction) {
                return res.status(401).json({
                    data: null,
                    error: 'Unauthorized'
                } as ApiResponse<null>);
            }

            const signingKey = req.app.get('SVS_SIGN_KEY');
            if (!signingKey) {
                return res.status(500).json({
                    data: null,
                    error: 'Signing key not configured'
                } as ApiResponse<null>);
            }

            const svsSignature: EthSignature = await signVotingTransaction(votingTransaction, signingKey);
            validateEthSignature(svsSignature);

            const signedTransaction = new VotingTransactionEntity();
            signedTransaction.electionID = votingTransaction.electionID
            signedTransaction.encryptedVote = votingTransaction.encryptedVote.hexString
            signedTransaction.svsSignature = svsSignature.hexString
            signedTransaction.unblindedElectionToken = normalizeHexString(votingTransaction.unblindedElectionToken.hexString.toLowerCase())
            signedTransaction.unblindedSignature = normalizeHexString(votingTransaction.unblindedSignature.hexString.toLowerCase())
            signedTransaction.voterAddress = normalizeEthAddress(votingTransaction.voterAddress)

            const repository = dataSource.getRepository(VotingTransactionEntity);
            await repository.save(signedTransaction);

            return res.status(200).json({
                data: { blindedSignature: svsSignature },
                error: null
            } as ApiResponse<{ blindedSignature: EthSignature }>);

        }
        catch (error) {
            logger.error('Error signing token:', error);
            res.status(500).json({
                data: null,
                error: 'Failed to sign Transaction. Error: ' + error
            } as ApiResponse<null>);
        };
    })

export default router;