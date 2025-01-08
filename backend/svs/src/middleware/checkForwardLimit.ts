import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/apiResponses';
import { SignatureData } from '@gelatonetwork/relay-sdk';
import { CallWithConcurrentERC2771Struct, CallWithERC2771Struct } from '@gelatonetwork/relay-sdk/dist/lib/erc2771/types';
import { normalizeEthAddress } from 'votingsystem';
import { dataSource } from '../database';
import { ForwardedTransactionEntity } from '../models/ForwardedTransaction';
import { logger } from '../utils/logger';


export async function checkForwardLimit(req: Request, res: Response, next: NextFunction) {

    try {
        const signatureData = req.body as SignatureData;

        if (!signatureData || !signatureData.struct || !signatureData.signature) {
            return res.status(400).json({
                data: null,
                error: 'Bad request: Missing required signature data'
            } as ApiResponse<null>);
        }


        const erc2771Request: CallWithERC2771Struct | CallWithConcurrentERC2771Struct = signatureData.struct
        const senderAddress = normalizeEthAddress(erc2771Request.user);
        const MAX_FORWARDS = req.app.get('GELATO_MAX_FORWARDS') || 10;

        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        const repository = queryRunner.manager.getRepository(ForwardedTransactionEntity);
        let forwardTransaction = await repository.findOne({
            where: { senderAddress: senderAddress },
            lock: { mode: 'pessimistic_write' }

        });
        if (!forwardTransaction) {
            forwardTransaction = new ForwardedTransactionEntity();
            forwardTransaction.senderAddress = senderAddress;
            forwardTransaction.forwardCount = 1;
            // logger.info(`New forward transaction for address: ${senderAddress}`);
        } else {
            forwardTransaction.forwardCount += 1;
            // logger.log("Existing forward transaction ", forwardTransaction.forwardCount)
            if (forwardTransaction.forwardCount > MAX_FORWARDS) {
                logger.warn(`Forward limit exceeded for address: ${senderAddress}. Limit: ${MAX_FORWARDS}, Attempted count: ${forwardTransaction.forwardCount}`);
                await queryRunner.rollbackTransaction();
                await queryRunner.release();
                return res.status(403).json({
                    data: null,
                    error: 'Forward limit exceeded'
                });
            }
            forwardTransaction.modifiedAt = new Date();
        }
        await repository.save(forwardTransaction);
        await queryRunner.commitTransaction();

        next();
    } catch (error) {
        logger.error('[ForwardLimit] Error in eligibility check. Error:', error);
        return res.status(500).json({
            data: null,
            error: 'Internal server error during forward limit check',
        } as ApiResponse<null>);
    }
}