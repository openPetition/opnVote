import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/apiResponses';
import { SignatureData } from '@gelatonetwork/relay-sdk';
import { CallWithConcurrentERC2771Struct, CallWithERC2771Struct } from '@gelatonetwork/relay-sdk/dist/lib/erc2771/types';
import { normalizeEthAddress } from 'votingsystem';
import { dataSource } from '../database';
import { ForwardedTransactionEntity } from '../models/ForwardedTransaction';
import { logger } from '../utils/logger';


async function incrementForwardCountWithUpsertAndCheck(senderAddress: string, MAX_FORWARDS: number) {
    const queryRunner = dataSource.createQueryRunner();
    try {
        await queryRunner.connect();
        await queryRunner.startTransaction('READ COMMITTED');


        const repo = queryRunner.manager.getRepository(ForwardedTransactionEntity);

        let record = await repo.findOne({
            where: { senderAddress },
            lock: { mode: 'pessimistic_write' },
        });

        if (!record) {
            record = repo.create({
                senderAddress,
                forwardCount: 1,
            });
            await repo.save(record);
        } else if (record.forwardCount < MAX_FORWARDS) {
            record.forwardCount += 1;
            await repo.save(record);
        } else {
            await queryRunner.rollbackTransaction();
            return {
                allowed: false,
                finalCount: record.forwardCount,
                message: 'Forward limit reached',
            };
        }

        await queryRunner.commitTransaction();
        return {
            allowed: true,
            finalCount: record.forwardCount,
            message: 'Forward accepted',
        };


    } catch (err) {
        if (queryRunner.isTransactionActive) {
            await queryRunner.rollbackTransaction();
        }
        throw err;
    } finally {
        await queryRunner.release();
    }
}


export async function checkForwardLimit(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
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

        const rawMaxForwards = req.app.get('GELATO_MAX_FORWARDS');
        const MAX_FORWARDS = typeof rawMaxForwards === 'number' ? rawMaxForwards : 10;

        logger.info(`[ForwardLimit] Starting forward limit check for address: ${senderAddress}, MAX_FORWARDS: ${MAX_FORWARDS}`);

        const dbStartTime = Date.now();
        const result = await incrementForwardCountWithUpsertAndCheck(senderAddress, MAX_FORWARDS);
        if (!result.allowed) {
            logger.warn(`[ForwardLimit] Forward limit exceeded for address: ${senderAddress}. Limit: ${MAX_FORWARDS}, Attempted count: ${result.finalCount} after ${Date.now() - dbStartTime}ms`);
            return res.status(403).json({
                data: null,
                error: 'Forward limit exceeded'
            });
        } else {
            logger.info(`[ForwardLimit] Forward limit check passed for address: ${senderAddress}. Final count: ${result.finalCount} after ${Date.now() - dbStartTime}ms`);
        }
        next();
    } catch (error) {
        const totalDuration = Date.now() - startTime;
        logger.error(`[ForwardLimit] Error in eligibility check after ${totalDuration}ms: ${error}`);
        return res.status(500).json({
            data: null,
            error: 'Internal server error during forward limit check',
        } as ApiResponse<null>);
    }
}