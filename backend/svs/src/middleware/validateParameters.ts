import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/apiResponses';
import { EthSignature, VotingTransaction, validateEthSignature, validateVotingTransaction } from 'votingsystem';


/**
 * Middleware to validate the parameters of a voting transaction request.
 * 
 * This function ensures that:
 * 1. Both votingTransaction and voterSignature are present in the request body.
 * 2. The votingTransaction object is valid according to the votingsystem's validation rules.
 * 3. The voterSignature is a valid Ethereum signature.
 * 4. The SVS signature is not already set.
 *
 * @param {Request} req - Express request object containing the voting transaction and signature.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware function.
 * @returns {Promise<void | Response>}
 */
export async function validateParameters(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {

        const votingTransaction = req.body.votingTransaction as VotingTransaction;
        const voterSignature = req.body.voterSignature as EthSignature;

        if (!votingTransaction || !voterSignature) {
            return res.status(401).json({
                data: null,
                error: 'Unauthorized or missing Voter Signature'
            });
        }

        validateVotingTransaction(votingTransaction)
        validateEthSignature(voterSignature)

        if (votingTransaction.svsSignature) {
            return res.status(401).json({
                data: null,
                error: 'SVS Signature is already set!'
            });

        }
        next();
    } catch (error) {
        // logger.error('Error processing signature validation:', error);
        return res.status(500).json({
            error: 'Failed to validate Voter Signature',
        } as ApiResponse<null>);
    }
}
