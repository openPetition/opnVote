import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/apiResponses';
import { EthSignature, RSAParams, Signature, Token, VotingTransaction, validateEthAddress, validateVotingTransaction, verifyUnblindedSignature } from 'votingsystem';
import { ethers } from 'ethers';
import { ElectionService } from '../services/electionService';


/**
 * Middleware to...
 * Ensures ..
 */
//! todo: test
//! Add format check
export async function validateBlindSignature(req: Request, res: Response, next: NextFunction) {
    // Parameters are already validated in previous middleware
    const votingTransaction = req.body.votingTransaction as VotingTransaction;
    const voterSignature = req.body.voterSignature as EthSignature;
    if (!votingTransaction || !voterSignature) {
        return res.status(401).json({
            data: null,
            error: 'Unauthorized or missing Voter Signature'
        });
    }
    try {
        const electionID: number = votingTransaction.electionID
        const unblindedSignature: Signature = votingTransaction.unblindedSignature
        const unblindedElectionToken: Token = votingTransaction.unblindedElectionToken
        const registerPubKey: RSAParams | null = await ElectionService.getElectionRegisterPublicKey(electionID)
        if (!registerPubKey) {
            return res.status(500).json({
                error: `Could not retrieve Register Public Key for Election ${electionID}. Please try again later.`
            });
        }



        const isValidSignature: Boolean = verifyUnblindedSignature(unblindedSignature, unblindedElectionToken, registerPubKey) //! Fix, throws in some cases even with correct input
        if (!isValidSignature) {
            return res.status(401).json({
                data: null,
                error: 'Blinded Signature is not valid'
            });
        }

        next();
    } catch (error) {
        // console.error('Error processing signature validation:', error);
        return res.status(500).json({
            error: 'Failed to validate Blind Signature',
        } as ApiResponse<null>);
    }
}
