import { Request, Response, NextFunction } from 'express'
import { ApiResponse } from '../types/apiResponses'
import { VotingTransaction, normalizeEthAddress } from 'votingsystem'
import { dataSource } from '../database'
import { ForwardedTransactionEntity } from '../models/ForwardedTransaction'
import { logger } from '../utils/logger'

async function incrementSponsorCountWithCheck(senderAddress: string, maxForwards: number) {
  const queryRunner = dataSource.createQueryRunner()
  try {
    await queryRunner.connect()
    await queryRunner.startTransaction('READ COMMITTED')

    const repo = queryRunner.manager.getRepository(ForwardedTransactionEntity)

    let record = await repo.findOne({
      where: { senderAddress },
      lock: { mode: 'pessimistic_write' },
    })

    if (!record) {
      record = repo.create({
        senderAddress,
        forwardCount: 1,
      })
      await repo.save(record)
    } else if (record.forwardCount < maxForwards) {
      record.forwardCount += 1
      await repo.save(record)
    } else {
      await queryRunner.rollbackTransaction()
      return {
        allowed: false,
        finalCount: record.forwardCount,
      }
    }

    await queryRunner.commitTransaction()
    return {
      allowed: true,
      finalCount: record.forwardCount,
    }
  } catch (err) {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction()
    }
    throw err
  } finally {
    await queryRunner.release()
  }
}

export async function checkSponsorLimit(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now()
  try {
    const votingTransaction = req.body.votingTransaction as VotingTransaction

    if (!votingTransaction || !votingTransaction.voterAddress) {
      logger.warn('[SponsorLimit] Missing voting transaction or voter address')
      return res.status(400).json({
        data: null,
        error: 'Bad request: Missing voting transaction',
      } as ApiResponse<null>)
    }

    const senderAddress = normalizeEthAddress(votingTransaction.voterAddress)

    const rawMaxSponsors = req.app.get('MAX_SPONSOR_COUNT')
    const maxSponsors = typeof rawMaxSponsors === 'number' ? rawMaxSponsors : 10

    logger.info(
      `[SponsorLimit] Checking sponsor limit for address: ${senderAddress}, max: ${maxSponsors}`,
    )

    const result = await incrementSponsorCountWithCheck(senderAddress, maxSponsors)
    if (!result.allowed) {
      logger.warn(
        `[SponsorLimit] Sponsor limit exceeded for address: ${senderAddress}. Limit: ${maxSponsors}, count: ${result.finalCount} after ${Date.now() - startTime}ms`,
      )
      return res.status(403).json({
        data: null,
        error: 'Sponsor limit exceeded',
      })
    }

    logger.info(
      `[SponsorLimit] Sponsor limit check passed for address: ${senderAddress}. Count: ${result.finalCount} after ${Date.now() - startTime}ms`,
    )
    next()
  } catch (error) {
    logger.error(`[SponsorLimit] Error in sponsor limit check after ${Date.now() - startTime}ms:`, error)
    return res.status(500).json({
      data: null,
      error: 'Internal server error during sponsor limit check',
    } as ApiResponse<null>)
  }
}
