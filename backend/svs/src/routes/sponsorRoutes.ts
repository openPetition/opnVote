import { Request, Response, Router } from 'express'
import { ApiResponse } from '../types/apiResponses'
import { signPaymasterData, createVoteCalldata } from 'votingsystem'
import { checkElectionStatus } from '../middleware/checkElectionStatus'
import { checkSponsorEligibility } from '../middleware/checkSponsorEligibility'
import { checkVoterSignature } from '../middleware/checkVoterSignature'
import { checkSponsorLimit } from '../middleware/checkSponsorLimit'
import { checkVoteCall } from '../middleware/checkVoteCall'
import { logger } from '../utils/logger'
import { ethers } from 'ethers'
import opnvoteAbi from '../abi/opnvote-0.3.0.json'
import { SponsorVotingTransaction } from '../types/sponsorTransaction'
import { GAS_DEFAULTS } from '../config/gasDefaults'

const ENTRYPOINT_ABI = ['function getNonce(address sender, uint192 key) view returns (uint256)']

const EXECUTE_ABI = ['function execute(address dest, uint256 value, bytes func)']

const router = Router()

/**
 * @openapi
 * components:
 *   schemas:
 *     EncryptedVotes:
 *       type: object
 *       required: [hexString, encryptionType]
 *       properties:
 *         hexString:
 *           type: string
 *           description: Hex-encoded encrypted vote payload.
 *         encryptionType:
 *           type: string
 *           enum: [RSA, AES]
 *     BlsSignature:
 *       type: object
 *       required: [hexString, isBlinded]
 *       properties:
 *         hexString:
 *           type: string
 *           description: Hex-encoded BLS12-381 G1 signature point.
 *         isBlinded:
 *           type: boolean
 *     EthSignature:
 *       type: object
 *       required: [hexString]
 *       properties:
 *         hexString:
 *           type: string
 *           description: Hex-encoded ECDSA signature (65 bytes).
 *     VotingTransaction:
 *       type: object
 *       required:
 *         - electionID
 *         - encryptedVoteRSA
 *         - encryptedVoteAES
 *         - unblindedSignature
 *         - voterAddress
 *       properties:
 *         electionID:
 *           type: integer
 *         encryptedVoteRSA:
 *           $ref: '#/components/schemas/EncryptedVotes'
 *         encryptedVoteAES:
 *           $ref: '#/components/schemas/EncryptedVotes'
 *         unblindedSignature:
 *           $ref: '#/components/schemas/BlsSignature'
 *         voterAddress:
 *           type: string
 *     RecastingVotingTransaction:
 *       type: object
 *       required:
 *         - electionID
 *         - encryptedVoteRSA
 *         - encryptedVoteAES
 *         - voterAddress
 *       properties:
 *         electionID:
 *           type: integer
 *         encryptedVoteRSA:
 *           $ref: '#/components/schemas/EncryptedVotes'
 *         encryptedVoteAES:
 *           $ref: '#/components/schemas/EncryptedVotes'
 *         voterAddress:
 *           type: string
 *     ApiResponse:
 *       type: object
 *       properties:
 *         data:
 *           nullable: true
 *         error:
 *           type: string
 *           nullable: true
 *
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
 *             required: [votingTransaction, voterSignature]
 *             properties:
 *               votingTransaction:
 *                 oneOf:
 *                   - $ref: '#/components/schemas/VotingTransaction'
 *                   - $ref: '#/components/schemas/RecastingVotingTransaction'
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
 *         description: Bad request (e.g., missing voting transaction)
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
      const votingTransaction = req.body.votingTransaction as SponsorVotingTransaction

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
async function buildPaymasterData(req: Request, votingTransaction: SponsorVotingTransaction) {
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

  const bundlerUrl = req.app.get('BUNDLER_URL') as string
  if (!bundlerUrl) throw new Error('BUNDLER_URL not configured')
  const gasPriceRes = await fetch(bundlerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'pimlico_getUserOperationGasPrice', params: [], id: 1 }),
  })
  const gasPriceJson = (await gasPriceRes.json()) as any
  if (!gasPriceJson.result?.standard) throw new Error('Failed to fetch gas price from bundler')
  const maxFeePerGas = BigInt(gasPriceJson.result.standard.maxFeePerGas)
  const maxPriorityFeePerGas = BigInt(gasPriceJson.result.standard.maxPriorityFeePerGas)

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
