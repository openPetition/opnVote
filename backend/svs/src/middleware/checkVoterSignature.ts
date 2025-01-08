import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/apiResponses';
import { EthSignature, VotingTransaction } from 'votingsystem';
import { ethers } from 'ethers';


/**
 * Middleware to verify the voter's signature on the voting transaction.
 * 
 * This function ensures that the voting transaction was signed by the voter.
 *
 * @param {Request} req - Express request object containing the voting transaction and signature.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware function.
 * @returns {Promise<void | Response>}
 */
export async function checkVoterSignature(req: Request, res: Response, next: NextFunction): Promise<void | Response> {

    // Parameters should be already validated in previous middleware
    const votingTransaction = req.body.votingTransaction as VotingTransaction;
    const voterSignature = req.body.voterSignature as EthSignature;

    try {

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
        // logger.error('Error processing signature validation:', error);
        return res.status(500).json({
            error: 'Failed to validate Voter Signature',
        } as ApiResponse<null>);
    }
}
