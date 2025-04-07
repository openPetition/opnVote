import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/apiResponses';
import { SignatureData } from '@gelatonetwork/relay-sdk';
import { CallWithConcurrentERC2771Struct, CallWithERC2771Struct } from '@gelatonetwork/relay-sdk/dist/lib/erc2771/types';
import { normalizeEthAddress } from 'votingsystem';
import { dataSource } from '../database';
import { ForwardedTransactionEntity } from '../models/ForwardedTransaction';
import { logger } from '../utils/logger';
import { QueryRunner } from 'typeorm';

export async function checkForwardLimit(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    let queryRunner: QueryRunner | undefined;
    try {
        const signatureData = req.body as SignatureData;

        if (!signatureData || !signatureData.struct || !signatureData.signature) {
            logger.warn('[ForwardLimit] Missing required signature data');
            return res.status(400).json({
                data: null,
                error: 'Bad request: Missing required signature data'
            } as ApiResponse<null>);
        }

        const erc2771Request: CallWithERC2771Struct | CallWithConcurrentERC2771Struct = signatureData.struct;
        const senderAddress = normalizeEthAddress(erc2771Request.user);
        const MAX_FORWARDS = req.app.get('GELATO_MAX_FORWARDS') || 10;

        logger.info(`[ForwardLimit] Starting forward limit check for address: ${senderAddress}`);

        const dbStartTime = Date.now();
        queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        const dbConnectDuration = Date.now() - dbStartTime;
        logger.info(`[ForwardLimit] Database connection established in ${dbConnectDuration}ms`);

        const repository = queryRunner.manager.getRepository(ForwardedTransactionEntity);
        const queryStartTime = Date.now();
        let forwardTransaction = await repository.findOne({
            where: { senderAddress: senderAddress },
            lock: { mode: 'pessimistic_write' }
        });
        const queryDuration = Date.now() - queryStartTime;
        logger.info(`[ForwardLimit] Forward transaction query completed in ${queryDuration}ms`);

        if (!forwardTransaction) {
            logger.info(`[ForwardLimit] Creating new forward transaction record for address: ${senderAddress}`);
            forwardTransaction = new ForwardedTransactionEntity();
            forwardTransaction.senderAddress = senderAddress;
            forwardTransaction.forwardCount = 1;
        } else {
            forwardTransaction.forwardCount += 1;
            logger.info(`[ForwardLimit] Incrementing forward count for ${senderAddress}. New count: ${forwardTransaction.forwardCount}`);

            if (forwardTransaction.forwardCount > MAX_FORWARDS) {
                logger.warn(`[ForwardLimit] Forward limit exceeded for address: ${senderAddress}. Limit: ${MAX_FORWARDS}, Attempted count: ${forwardTransaction.forwardCount}`);
                if (queryRunner?.isTransactionActive) {
                    await queryRunner.rollbackTransaction();
                    logger.info('[ForwardLimit] Transaction rolled back due to forward limit exceeded');
                }
                return res.status(403).json({
                    data: null,
                    error: 'Forward limit exceeded'
                });
            }
            forwardTransaction.modifiedAt = new Date();
        }

        const saveStartTime = Date.now();
        await repository.save(forwardTransaction);
        await queryRunner.commitTransaction();
        const saveDuration = Date.now() - saveStartTime;
        logger.info(`[ForwardLimit] Successfully saved and committed transaction in ${saveDuration}ms`);

        const totalDuration = Date.now() - startTime;
        logger.info(`[ForwardLimit] Completed forward limit check in ${totalDuration}ms for ${senderAddress}`);

        next();
    } catch (error) {
        const totalDuration = Date.now() - startTime;
        logger.error(`[ForwardLimit] Error in eligibility check after ${totalDuration}ms: ${error}`);

        if (queryRunner?.isTransactionActive) {
            try {
                await queryRunner.rollbackTransaction();
                logger.info('[ForwardLimit] Successfully rolled back transaction after error');
            } catch (rollbackError) {
                logger.error(`[ForwardLimit] Error rolling back transaction: ${rollbackError}`);
            }
        }

        return res.status(500).json({
            data: null,
            error: 'Internal server error during forward limit check',
        } as ApiResponse<null>);
    } finally {
        if (queryRunner) {
            try {
                await queryRunner.release();
                logger.info('[ForwardLimit] Successfully released query runner');
            } catch (releaseError) {
                logger.error(`[ForwardLimit] Error releasing query runner: ${releaseError}`);
            }
        }
    }
}