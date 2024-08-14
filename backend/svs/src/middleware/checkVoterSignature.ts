import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/apiResponses';
import { EthSignature, VotingTransaction, validateEthAddress, validateVotingTransaction } from 'votingsystem';
import { ethers } from 'ethers';


/**
 * Middleware to...
 * Ensures ..
 */
export async function checkVoterSignature(req: Request, res: Response, next: NextFunction) {
    try {

        // Parameters should be already validated in previous middleware
        const votingTransaction = req.body.votingTransaction as VotingTransaction;
        const voterSignature = req.body.voterSignature as EthSignature;

        if (!votingTransaction || !voterSignature) {
            return res.status(401).json({
                data: null,
                error: 'Unauthorized or missing Voter Signature'
            });
        }
        const voterAddress = votingTransaction.voterAddress;
        const message = JSON.stringify(votingTransaction);
        const messageHash = ethers.hashMessage(message);

        const recoveredAddress = ethers.verifyMessage(messageHash, voterSignature.hexString);
        if (recoveredAddress.toLowerCase() !== voterAddress.toLowerCase()) {
            return res.status(401).json({
                data: null,
                error: 'Invalid Voter signature'
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
