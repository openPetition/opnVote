import { Request, Response, NextFunction } from 'express';
import { dataSource } from '../database';
import { ApiResponse } from '../types/apiResponses';
import { EthSignature, Token, VotingTransaction } from 'votingsystem';
import { VotingTransactionEntity } from '../models/VotingTransaction';


/**
 * Middleware to check if user already received a blinded Signature for election ID
 */
//!test
export async function checkForExistingSVSSignature(req: Request, res: Response, next: NextFunction) {

    const votingTransaction = req.body.votingTransaction as VotingTransaction;
    const voterSignature = req.body.voterSignature as EthSignature;

    if (!votingTransaction || !voterSignature) {
        return res.status(401).json({
            data: null,
            error: 'Unauthorized or missing Voter Signature'
        });
    }


    try {
        const lowerCaseUnblindedElectionToken = votingTransaction.unblindedElectionToken.hexString.toLowerCase()
        const lowerCaseUnblindedSignature = votingTransaction.unblindedSignature.hexString.toLowerCase()
        const repository = dataSource.getRepository(VotingTransactionEntity);
        const existingSignedVotingTransaction = await repository.findOne({
            where: {
                electionID: votingTransaction.electionID,
                unblindedElectionToken: lowerCaseUnblindedElectionToken,
                unblindedSignature: lowerCaseUnblindedSignature
            },
        });



        if (existingSignedVotingTransaction) {

            return res.status(200).json({
                data: {
                    message: 'Existing SVS signature found.',
                    blindedSignature: existingSignedVotingTransaction.svsSignature,
                },
                error: null
            } as ApiResponse<{ message: string, blindedSignature: string }>);
        }

        next();
    } catch (error) {
        console.error('Database error:', error);
        return res.status(500).json({
            data: null,
            error: 'Internal server error',
        } as ApiResponse<null>);
    }
};

export default checkForExistingSVSSignature;
