import { Request, Response, Router } from 'express'
import { ApiResponse } from '../types/apiResponses'
import { VotingTransaction, signPaymasterData, createVoteCalldata } from 'votingsystem'
import { checkElectionStatus } from '../middleware/checkElectionStatus'
import { checkSponsorEligibility } from '../middleware/checkSponsorEligibility'
import { checkVoterSignature } from '../middleware/checkVoterSignature'
import { checkSponsorLimit } from '../middleware/checkSponsorLimit'
import { checkVoteCall } from '../middleware/checkVoteCall'
import { logger } from '../utils/logger'
import { ethers } from 'ethers'
import opnvoteAbi from '../abi/opnvote-0.1.0.json'

const GAS_DEFAULTS = {
  callGasLimit: 150_000n, // vote()
  verificationGasLimit: 110_000n, // smart account validateUserOp
  paymasterVerificationGasLimit: 80_000n, // paymaster validatePaymasterUserOp
  paymasterPostOpGasLimit: 1n, // no postOp logic
  preVerificationGas: 200_000n, // bundler overhead
}

const ENTRYPOINT_ABI = ['function getNonce(address sender, uint192 key) view returns (uint256)']

const EXECUTE_ABI = ['function execute(address dest, uint256 value, bytes func)']

const router = Router()

/**
 * @openapi
 * /api/userOp/sponsor:
 *   post:
 *     summary: Sponsor a voting UserOperation
 *     description: Returns paymaster data and gas parameters.
 *     tags: [Voting]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               votingTransaction:
 *                 $ref: '#/components/schemas/VotingTransaction'
 *               voterSignature:
 *                 $ref: '#/components/schemas/EthSignature'
 *     responses:
 *       200:
 *         description: Successfully generated paymaster data and gas parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Bad request (e.g., missing voting transaction or SVS signature)
 *       403:
 *         description: Forbidden (e.g., election is closed)
 *       500:
 *         description: Internal server error
 */
router.post(
  '/sponsor',
  checkSponsorEligibility, // Validates request structure, voting transaction fields, and 7702 delegation
  checkVoterSignature, // Verifies the caller signature
  checkElectionStatus,
  checkVoteCall, // Simulates vote()
  checkSponsorLimit, // Enforces sponsorship limits
  async (req: Request, res: Response) => {
    const startTime = Date.now()
    logger.info(`[SponsorRoute] Starting sponsor request at ${new Date().toISOString()}`)

    try {
      const votingTransaction = req.body.votingTransaction as VotingTransaction

      logger.info(
        `[SponsorRoute] Processing sponsor for election ${votingTransaction.electionID} and voter ${votingTransaction.voterAddress}`,
      )

      const result = await buildPaymasterData(req, votingTransaction)

      logger.info(`[SponsorRoute] Request completed in ${Date.now() - startTime}ms`)
      return res.status(200).json({
        data: result,
        error: null,
      })
    } catch (error) {
      logger.error('[SponsorRoute] Error building paymaster data:', error)
      res.status(500).json({
        data: null,
        error: 'Internal server error',
      } as ApiResponse<null>)
    }
  },
)

/**
 * Builds paymaster data with gas params.
 */
async function buildPaymasterData(req: Request, votingTransaction: VotingTransaction) {
  const paymasterSignerKey = req.app.get('PAYMASTER_SIGNER_KEY')
  const paymasterAddress = req.app.get('PAYMASTER_ADDRESS')
  const chainId = req.app.get('CHAIN_ID') as number
  const entryPointAddress = req.app.get('ENTRYPOINT_ADDRESS') as string
  const provider = req.app.get('rpcProvider') as ethers.JsonRpcProvider

  if (!paymasterSignerKey || !paymasterAddress) {
    throw new Error('Paymaster not configured')
  }

  if (!entryPointAddress || !provider) {
    throw new Error('EntryPoint or RPC provider not configured')
  }

  const feeData = await provider.getFeeData()
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? ethers.parseUnits('1', 'gwei')
  const maxFeePerGas = feeData.maxFeePerGas ?? maxPriorityFeePerGas * 2n

  const entryPoint = new ethers.Contract(entryPointAddress, ENTRYPOINT_ABI, provider)
  const nonce: bigint = await entryPoint.getNonce(votingTransaction.voterAddress, 0)

  const opnVoteAddress = req.app.get('OPNVOTE_CONTRACT_ADDRESS') as string
  if (!opnVoteAddress) {
    throw new Error('OPNVOTE_CONTRACT_ADDRESS not configured')
  }

  const voteCalldata = createVoteCalldata(votingTransaction, opnvoteAbi)
  const executeIface = new ethers.Interface(EXECUTE_ABI)
  const callData = executeIface.encodeFunctionData('execute', [opnVoteAddress, 0, voteCalldata])

  const now = Math.floor(Date.now() / 1000)
  const validUntil = now + 3600
  const validAfter = now - 120

  const result = await signPaymasterData(
    {
      sender: votingTransaction.voterAddress,
      nonce,
      initCode: '0x',
      callData,
      ...GAS_DEFAULTS,
      maxPriorityFeePerGas,
      maxFeePerGas,
      validUntil,
      validAfter,
      chainId,
      paymasterAddress,
    },
    paymasterSignerKey,
  )

  logger.info('[SponsorRoute] Paymaster data signed successfully')

  return {
    paymasterData: result.paymasterData,
    userOpParams: {
      callGasLimit: GAS_DEFAULTS.callGasLimit.toString(),
      verificationGasLimit: GAS_DEFAULTS.verificationGasLimit.toString(),
      paymasterVerificationGasLimit: GAS_DEFAULTS.paymasterVerificationGasLimit.toString(),
      paymasterPostOpGasLimit: GAS_DEFAULTS.paymasterPostOpGasLimit.toString(),
      preVerificationGas: GAS_DEFAULTS.preVerificationGas.toString(),
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
      nonce: nonce.toString(),
      validUntil,
      validAfter,
    },
  }
}

export default router
