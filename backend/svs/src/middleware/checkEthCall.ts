import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/apiResponses';
import { SignatureData } from '@gelatonetwork/relay-sdk';
import { ethers } from 'ethers';
import { logger } from '../utils/logger';

export async function checkEthCall(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    try {
        const signatureData = req.body as SignatureData;

        if (!signatureData || !signatureData.struct || !signatureData.signature) {
            logger.warn('[EthCall] Missing required signature data');
            return res.status(400).json({
                data: null,
                error: 'Bad request: Missing required signature data'
            } as ApiResponse<null>);
        }

        const rpcProvider: ethers.JsonRpcProvider = req.app.get('rpcProvider');
        try {
            logger.info(`[EthCall] Starting RPC call simulation for user: ${signatureData.struct.user}`);
            const rpcStartTime = Date.now();
            const result = await rpcProvider.call({
                to: signatureData.struct.target,
                data: signatureData.struct.data.toString(),
                from: signatureData.struct.user,
            });
            const rpcDuration = Date.now() - rpcStartTime;
            logger.info(`[EthCall] RPC call completed in ${rpcDuration}ms for user: ${signatureData.struct.user}`);

            if (result.toLowerCase() !== "0x") {
                logger.warn(`[EthCall] Unexpected return value from transaction simulation: ${result} for user: ${signatureData.struct.user} and target: ${signatureData.struct.target}`);
                return res.status(400).json({
                    data: null,
                    error: 'Transaction simulation failed: Unexpected return value'
                } as ApiResponse<null>);
            }

            const totalDuration = Date.now() - startTime;
            logger.info(`[EthCall] Successfully validated transaction in ${totalDuration}ms for user: ${signatureData.struct.user}`);
            next();
        } catch (callError) {
            const rpcDuration = Date.now() - startTime;
            logger.error(`[EthCall] Transaction simulation failed after ${rpcDuration}ms. Error: ${callError}`);
            return res.status(400).json({
                data: null,
                error: 'Transaction simulation failed'
            } as ApiResponse<null>);
        }
    } catch (error) {
        const totalDuration = Date.now() - startTime;
        logger.error(`[EthCall] Error in eth call check after ${totalDuration}ms. Error: ${error}`);
        return res.status(500).json({
            data: null,
            error: 'Internal server error during eth call check'
        } as ApiResponse<null>);
    }
}