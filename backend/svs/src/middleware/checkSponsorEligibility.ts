import { Request, Response, NextFunction } from 'express'
import { ApiResponse } from '../types/apiResponses'
import { VotingTransaction, validateVotingTransaction } from 'votingsystem'
import { ethers } from 'ethers'
import { logger } from '../utils/logger'

// EIP-7702 delegation designator prefix: 0xef0100
const EIP7702_PREFIX = '0xef0100'

/**
 * Middleware that validates the sponsor request structure and account delegation.
 *
 */
export async function checkSponsorEligibility(req: Request, res: Response, next: NextFunction) {
  try {
    const votingTransaction = req.body.votingTransaction as VotingTransaction

    if (!votingTransaction) {
      return res.status(400).json({
        data: null,
        error: 'Missing voting transaction',
      } as ApiResponse<null>)
    }

    validateVotingTransaction(votingTransaction)

    // Verify EIP-7702 account delegation
    const provider = req.app.get('rpcProvider') as ethers.JsonRpcProvider
    const expectedImplementation = req.app.get('ACCOUNT_IMPLEMENTATION_ADDRESS') as string

    if (!expectedImplementation) {
      logger.error('[SponsorEligibility] ACCOUNT_IMPLEMENTATION_ADDRESS not configured')
      return res.status(500).json({
        data: null,
        error: 'Account implementation not configured',
      } as ApiResponse<null>)
    }

    const code = await provider.getCode(votingTransaction.voterAddress)

    if (code === '0x') {
      logger.info(`[SponsorEligibility] Fresh EOA for voter ${votingTransaction.voterAddress}`)
    } else if (code.toLowerCase().startsWith(EIP7702_PREFIX)) {
      const delegationTarget = '0x' + code.slice(EIP7702_PREFIX.length)
      if (delegationTarget.toLowerCase() !== expectedImplementation.toLowerCase()) {
        logger.warn(
          `[SponsorEligibility] Unexpected delegation target ${delegationTarget} for voter ${votingTransaction.voterAddress}, expected ${expectedImplementation}`,
        )
        return res.status(403).json({
          data: null,
          error: 'Invalid account delegation',
        } as ApiResponse<null>)
      }
      logger.info(
        `[SponsorEligibility] Valid existing delegation for voter ${votingTransaction.voterAddress}`,
      )
    } else {
      logger.warn(
        `[SponsorEligibility] Unexpected code at voter address ${votingTransaction.voterAddress}`,
      )
      return res.status(403).json({
        data: null,
        error: 'Invalid account delegation',
      } as ApiResponse<null>)
    }

    logger.info(
      `[SponsorEligibility] Request eligible for election ${votingTransaction.electionID} voter ${votingTransaction.voterAddress}`,
    )
    next()
  } catch (error) {
    logger.error('[SponsorEligibility] Error in eligibility check:', error)
    return res.status(400).json({
      data: null,
      error: 'Bad request: Invalid voting transaction data',
    } as ApiResponse<null>)
  }
}
