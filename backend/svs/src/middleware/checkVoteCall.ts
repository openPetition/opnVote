import { Request, Response, NextFunction } from 'express'
import { ApiResponse } from '../types/apiResponses'
import { VotingTransaction, createVoteCalldata } from 'votingsystem'
import { ethers } from 'ethers'
import { logger } from '../utils/logger'
import opnvoteAbi from '../abi/opnvote-0.1.0.json'

/**
 * Middleware simulating the vote() call on-chai
 */
export async function checkVoteCall(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now()
  try {
    const votingTransaction = req.body.votingTransaction as VotingTransaction

    if (!votingTransaction) {
      return res.status(400).json({
        data: null,
        error: 'Bad request: Missing voting transaction',
      } as ApiResponse<null>)
    }

    const rpcProvider = req.app.get('rpcProvider') as ethers.JsonRpcProvider
    const opnvoteAddress = req.app.get('OPNVOTE_CONTRACT_ADDRESS') as string

    if (!rpcProvider || !opnvoteAddress) {
      logger.error('[VoteCall] RPC provider or contract address not configured')
      return res.status(500).json({
        data: null,
        error: 'RPC provider or contract address not configured',
      } as ApiResponse<null>)
    }

    const callData = createVoteCalldata(votingTransaction, opnvoteAbi)

    logger.info(
      `[VoteCall] Simulating vote() for election ${votingTransaction.electionID} voter ${votingTransaction.voterAddress}`,
    )

    const MAX_ATTEMPTS = 3
    const RETRY_DELAY_MS = 500

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await rpcProvider.call({
          to: opnvoteAddress,
          data: callData,
          from: votingTransaction.voterAddress,
        })

        const rpcDuration = Date.now() - startTime
        logger.info(
          `[VoteCall] RPC simulation completed in ${rpcDuration}ms for voter ${votingTransaction.voterAddress}`,
        )

        if (result.toLowerCase() !== '0x') {
          logger.warn(
            `[VoteCall] Unexpected return value from vote simulation: ${result} for voter ${votingTransaction.voterAddress}`,
          )
          return res.status(400).json({
            data: null,
            error: 'Vote simulation failed: Unexpected return value',
          } as ApiResponse<null>)
        }

        return next()
      } catch (error: any) {
        const isTimeout = error?.code === 'TIMEOUT' || error?.message?.includes('timeout')

        if (isTimeout && attempt < MAX_ATTEMPTS) {
          logger.warn(
            `[VoteCall] RPC call timeout, retrying in ${RETRY_DELAY_MS}ms (attempt ${attempt}/${MAX_ATTEMPTS}) for voter ${votingTransaction.voterAddress}`,
          )
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
          continue
        }

        const rpcDuration = Date.now() - startTime
        logger.error(
          `[VoteCall] Vote simulation failed after ${rpcDuration}ms for voter ${votingTransaction.voterAddress}: ${error}`,
        )
        return res.status(400).json({
          data: null,
          error: 'Vote simulation failed',
        } as ApiResponse<null>)
      }
    }
  } catch (error) {
    const totalDuration = Date.now() - startTime
    logger.error(`[VoteCall] Error in vote call check after ${totalDuration}ms:`, error)
    return res.status(500).json({
      data: null,
      error: 'Internal server error during vote simulation',
    } as ApiResponse<null>)
  }
}
