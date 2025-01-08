import { Request, Response, NextFunction } from 'express';
import { dataSource } from '../database';
import { ApiResponse } from '../types/apiResponses';
import { normalizeEthAddress, VotingTransaction } from 'votingsystem';
import { VotingTransactionEntity } from '../models/VotingTransaction';
import { logger } from '../utils/logger';


/**
 * Middleware to check if a voter address has already submitted a transaction for the current election.
 * 
 * This function verifies that each voter address is only used in one transaction per election.
 *
 * @param {Request} req - Express request object containing the voting transaction and signature.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware function.
 * @returns {Promise<void | Response>}
 */
export async function checkVoterHasNotVoted(req: Request, res: Response, next: NextFunction): Promise<void | Response> {

    // Parameters should be already validated in previous middleware
    const votingTransaction = req.body.votingTransaction as VotingTransaction;

    try {
        const repository = dataSource.getRepository(VotingTransactionEntity);
        const voterAddressNormalized = normalizeEthAddress(votingTransaction.voterAddress);

        // Check if a transaction from this voter for this election already exists
        const existingTransaction = await repository.findOne({
            where: {
                electionID: votingTransaction.electionID,
                voterAddress: voterAddressNormalized,
            },
        });

        if (existingTransaction) {
            return res.status(400).json({
                data: null,
                error: 'Voter has already submitted a transaction for this election',
            } as ApiResponse<null>);
        }

        next();
    } catch (error) {
        logger.error('Database error:', error);
        return res.status(500).json({
            data: null,
            error: 'Internal server error',
        } as ApiResponse<null>);
    }
};

export default checkVoterHasNotVoted;
