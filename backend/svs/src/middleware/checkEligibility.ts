import { Request, Response, NextFunction } from 'express'
import { ApiResponse } from '../types/apiResponses'
import { SignatureData } from '@gelatonetwork/relay-sdk'
import {
  CallWithConcurrentERC2771Struct,
  CallWithERC2771Struct,
} from '@gelatonetwork/relay-sdk/dist/lib/erc2771/types'
import { ethers } from 'ethers'
import opnvoteAbi from '../abi/opnvote-0.1.0.json'
import { logger } from '../utils/logger'
import { validateGelatoSignature } from 'votingsystem'

export function checkEligibility(req: Request, res: Response, next: NextFunction) {
  try {
    const signatureData = req.body as SignatureData

    if (!signatureData || !signatureData.struct || !signatureData.signature) {
      return res.status(400).json({
        data: null,
        error: 'Bad request: Missing required signature data',
      } as ApiResponse<null>)
    }

    validateGelatoSignature(signatureData) // Throws error if signature is invalid

    const OPNVOTE_CONTRACT_ADDRESS = req.app.get('OPNVOTE_CONTRACT_ADDRESS')
    if (!OPNVOTE_CONTRACT_ADDRESS || !ethers.isAddress(OPNVOTE_CONTRACT_ADDRESS)) {
      return res.status(500).json({
        data: null,
        error: 'OPNVOTE_CONTRACT_ADDRESS not configured',
      } as ApiResponse<null>)
    }

    const erc2771Request: CallWithERC2771Struct | CallWithConcurrentERC2771Struct =
      signatureData.struct
    const target = erc2771Request.target
    const calldata = erc2771Request.data

    if (target.toLowerCase() != OPNVOTE_CONTRACT_ADDRESS.toLowerCase()) {
      return res.status(400).json({
        data: null,
        error: 'Bad request: Wrong target address',
      } as ApiResponse<null>)
    }

    const calldataString = calldata.toString().toLowerCase()
    const vote4ByteSig = '0x1c700694'
    if (!calldataString.startsWith(vote4ByteSig)) {
      return res.status(400).json({
        data: null,
        error: 'Bad request: Invalid calldata',
      } as ApiResponse<null>)
    }

    const transactionSender = signatureData.struct.user
    const opnVoteInterface = new ethers.Interface(opnvoteAbi)
    const decodedVotingCalldata = opnVoteInterface.decodeFunctionData(
      'vote',
      signatureData.struct.data.toString(),
    )
    const voterAddress = decodedVotingCalldata[1]

    if (transactionSender.toLowerCase() != voterAddress.toLowerCase()) {
      return res.status(400).json({
        data: null,
        error: 'Bad request: Signer must be voter',
      } as ApiResponse<null>)
    }

    next()
  } catch (error) {
    logger.error('[Eligibility] Error in eligibility check. Error:', error)
    return res.status(500).json({
      data: null,
      error: 'Internal server error during eligibility check',
    } as ApiResponse<null>)
  }
}
