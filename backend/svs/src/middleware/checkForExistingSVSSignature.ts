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
    const startTime = Date.now();
    logger.info(`[ExistingSVS] Starting check for existing SVS signature at ${new Date().toISOString()}`);

    // Parameters should be already validated in previous middleware
    const votingTransaction = req.body.votingTransaction as VotingTransaction;

    try {
        const electionID = votingTransaction.electionID;
        const normalizedElectionTokenHex: string = normalizeHexString(votingTransaction.unblindedElectionToken.hexString.toLowerCase());
        const normalizedUnblindedSignatureHex: string = normalizeHexString(votingTransaction.unblindedSignature.hexString.toLowerCase());

        logger.info(`[ExistingSVS] Checking for exact match in database for election ${electionID}`);
        const dbStartTime = Date.now();
        const repository = dataSource.getRepository(VotingTransactionEntity);

        // Check for exact match in the database
        const exactMatch = await repository.findOne({
            where: {
                electionID: electionID,
                unblindedElectionToken: normalizedElectionTokenHex,
                unblindedSignature: normalizedUnblindedSignatureHex
            },
        });
        const dbDuration = Date.now() - dbStartTime;
        logger.info(`[ExistingSVS] Database exact match query completed in ${dbDuration}ms`);

        if (exactMatch) {
            logger.info(`[ExistingSVS] Found existing SVS signature for election ${electionID}`);
            // If an exact match is found, return the existing SVS signature
            const svsSignature: EthSignature = { hexString: exactMatch.svsSignature };
            validateEthSignature(svsSignature);

            const totalDuration = Date.now() - startTime;
            logger.info(`[ExistingSVS] Request completed successfully in ${totalDuration}ms`);

            return res.status(200).json({
                data: {
                    message: 'Existing SVS signature found.',
                    blindedSignature: svsSignature,
                },
                error: null
            } as ApiResponse<{ message: string, blindedSignature: EthSignature }>);
        }

        logger.info(`[ExistingSVS] Checking for partial matches in database for election ${electionID}`);
        const partialStartTime = Date.now();
        // Check for partial matches that shouldn't exist
        const partialMatch = await repository.findOne({
            where: [
                { unblindedElectionToken: normalizedElectionTokenHex },
                { unblindedSignature: normalizedUnblindedSignatureHex }
            ]
        });
        const partialDuration = Date.now() - partialStartTime;
        logger.info(`[ExistingSVS] Database partial match query completed in ${partialDuration}ms`);

        if (partialMatch) {
            logger.error(`[ExistingSVS] Found inconsistent data for election ${electionID}: ${partialMatch}`);
            return res.status(409).json({
                data: null,
                error: 'Inconsistent voting data detected. Please contact support.'
            } as ApiResponse<null>);
        }

        const totalDuration = Date.now() - startTime;
        logger.info(`[ExistingSVS] Request completed successfully in ${totalDuration}ms`);
        next();
    } catch (error) {
        const totalDuration = Date.now() - startTime;
        logger.error(`[ExistingSVS] Error checking for existing SVS signature after ${totalDuration}ms: ${error}`);
        return res.status(500).json({
            data: null,
            error: 'Internal server error',
        } as ApiResponse<null>);
    }
}

export default checkForExistingSVSSignature;
