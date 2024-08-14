import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/apiResponses';
import { EthSignature, VotingTransaction, validateEthAddress, validateEthSignature, validateSignature, validateVotingTransaction } from 'votingsystem';


/**
 * Middleware to...
 * Ensures ..
 */
export async function validateParameters(req: Request, res: Response, next: NextFunction) {
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

        if(votingTransaction.svsSignature){
            return res.status(401).json({
                data: null,
                error: 'SVS Signature is already set!'
            });

          }


        next();
    } catch (error) {
        // console.error('Error processing signature validation:', error);
        return res.status(500).json({
            error: 'Failed to validate Voter Signature',
        } as ApiResponse<null>);
    }
}
