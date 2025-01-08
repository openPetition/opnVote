import { Request, Response, NextFunction } from 'express';
import { dataSource } from '../database';
import { ApiResponse } from '../types/apiResponses';
import { EthSignature, normalizeHexString, Token, validateEthSignature, VotingTransaction } from 'votingsystem';
import { VotingTransactionEntity } from '../models/VotingTransaction';
import { logger } from '../utils/logger';

/**
 * Middleware to check for an existing SVS signature.
 * 
 * This function verifies if a voting transaction has already been signed by the SVS.
 *
 * @param {Request} req - Express request object containing the voting transaction and signature.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware function.
 * @returns {Promise<void | Response>}
 */
export async function checkForExistingSVSSignature(req: Request, res: Response, next: NextFunction): Promise<void | Response> {

    // Parameters should be already validated in previous middleware
    const votingTransaction = req.body.votingTransaction as VotingTransaction;

    try {
        const electionID = votingTransaction.electionID;
        const normalizedElectionTokenHex: string = normalizeHexString(votingTransaction.unblindedElectionToken.hexString.toLowerCase());
        const normalizedUnblindedSignatureHex: string = normalizeHexString(votingTransaction.unblindedSignature.hexString.toLowerCase());

        const repository = dataSource.getRepository(VotingTransactionEntity);

        // Check for exact match in the database
        const exactMatch = await repository.findOne({
            where: {
                electionID: electionID,
                unblindedElectionToken: normalizedElectionTokenHex,
                unblindedSignature: normalizedUnblindedSignatureHex
            },
        });

        if (exactMatch) {
            // If an exact match is found, return the existing SVS signature
            const svsSignature: EthSignature = { hexString: exactMatch.svsSignature };
            validateEthSignature(svsSignature);

            return res.status(200).json({
                data: {
                    message: 'Existing SVS signature found.',
                    blindedSignature: svsSignature,
                },
                error: null
            } as ApiResponse<{ message: string, blindedSignature: EthSignature }>);
        }

        // Check for partial matches that shouldn't exist
        const partialMatch = await repository.findOne({
            where: [
                { unblindedElectionToken: normalizedElectionTokenHex },
                { unblindedSignature: normalizedUnblindedSignatureHex }
            ]
        });

        if (partialMatch) {
            logger.error('Inconsistent data found:', partialMatch);
            return res.status(409).json({
                data: null,
                error: 'Inconsistent voting data detected. Please contact support.'
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
}

export default checkForExistingSVSSignature;
