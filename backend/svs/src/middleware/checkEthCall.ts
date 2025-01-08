import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/apiResponses';
import { SignatureData } from '@gelatonetwork/relay-sdk';
import { ethers } from 'ethers';
import { logger } from '../utils/logger';

export async function checkEthCall(req: Request, res: Response, next: NextFunction) {
    try {
        const signatureData = req.body as SignatureData;

        if (!signatureData || !signatureData.struct || !signatureData.signature) {
            return res.status(400).json({
                data: null,
                error: 'Bad request: Missing required signature data'
            } as ApiResponse<null>);
        }

        const rpcProvider: ethers.JsonRpcProvider = req.app.get('rpcProvider');
        try {

            const result = await rpcProvider.call({
                to: signatureData.struct.target,
                data: signatureData.struct.data.toString(),
                from: signatureData.struct.user,
            });

            if (result.toLowerCase() !== "0x") {
                logger.info(`Unexpected return value from transaction simulation: ${result} for user: ${signatureData.struct.user} and target: ${signatureData.struct.target} and data: ${signatureData.struct.data.toString()}`);
                return res.status(400).json({
                    data: null,
                    error: 'Transaction simulation failed: Unexpected return value'
                } as ApiResponse<null>);
            }

            next();
        } catch (callError) {
            logger.error('[EthCall] Transaction simulation failed:. Error:', callError);
            return res.status(400).json({
                data: null,
                error: 'Transaction simulation failed'
            } as ApiResponse<null>);
        }
    } catch (error) {
        logger.error('[EthCall] Error in eth call check: Error:', error);
        return res.status(500).json({
            data: null,
            error: 'Internal server error during eth call check'
        } as ApiResponse<null>);
    }
}