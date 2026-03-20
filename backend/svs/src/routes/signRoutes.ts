import { Request, Response, Router } from 'express'
import { ApiResponse } from '../types/apiResponses'
import {
  EthSignature,
  VotingTransaction,
  normalizeEthAddress,
  normalizeHexString,
  signVotingTransaction,
  validateEthSignature,
} from 'votingsystem'
import { checkVoterSignature } from '../middleware/checkVoterSignature'
import { validateParameters } from '../middleware/validateParameters'
import { checkElectionStatus } from '../middleware/checkElectionStatus'
import { validateBlindSignature } from '../middleware/validateBlindSignature'
import { dataSource } from '../database'
import { VotingTransactionEntity } from '../models/VotingTransaction'
import { logger } from '../utils/logger'
async function upsertVotingTransactionWithValidation(
  electionId: number,
  voterAddress: string,
  encryptedVoteRsa: string,
  encryptedVoteAes: string,
  unblindedElectionToken: string,
  unblindedSignature: string,
  svsSignature: string,
) {
  const queryRunner = dataSource.createQueryRunner()
  try {
    await queryRunner.connect()
    await queryRunner.startTransaction('READ COMMITTED')

    const repo = queryRunner.manager.getRepository(VotingTransactionEntity)

    let record = await repo.findOne({
      where: {
        unblindedElectionToken,
        electionId,
      },
      lock: { mode: 'pessimistic_write' },
    })
    const isNew = !record

    if (!record) {
      record = repo.create({
        electionId,
        voterAddress,
        encryptedVoteRsa,
        encryptedVoteAes,
        unblindedElectionToken,
        unblindedSignature,
        svsSignature,
      })
      await repo.save(record)
    } else {
      if (record.voterAddress !== voterAddress) {
        await queryRunner.rollbackTransaction()
        throw new Error('Voter address mismatch for existing unblinded election token')
      }
      if (record.unblindedSignature !== unblindedSignature) {
        await queryRunner.rollbackTransaction()
        throw new Error('Unblinded signature mismatch for existing unblinded election token')
      }
      if (record.electionId !== electionId) {
        await queryRunner.rollbackTransaction()
        throw new Error('Election ID mismatch for existing unblinded election token')
      }

      record.encryptedVoteRsa = encryptedVoteRsa
      record.encryptedVoteAes = encryptedVoteAes
      record.svsSignature = svsSignature
      await repo.save(record)
    }

    await queryRunner.commitTransaction()
    return {
      success: true,
      isNew,
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

const router = Router()
/**
 * @openapi
 * /api/votingTransaction/sign:
 *   post:
 *     summary: Sign a voting transaction
 *     description: Validates and signs a voting transaction, returning the SVS signature.
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
 *         description: Successfully signed the voting transaction
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Bad request (e.g., invalid parameters, voter has already voted)
 *       401:
 *         description: Unauthorized (e.g., invalid voter signature)
 *       403:
 *         description: Forbidden (e.g., election is closed)
 *       500:
 *         description: Internal server error
 */
router.post(
  '/sign',
  validateParameters, // Validates the structure and format of the request parameters
  checkVoterSignature, // Verifies that the voting transaction is correctly signed by the voter
  checkElectionStatus, // Ensures that the election is still open for voting
  validateBlindSignature, // Validates the blind signature from the register
  async (req: Request, res: Response) => {
    const startTime = Date.now()
    logger.info(`[SignRoute] Starting sign request processing at ${new Date().toISOString()}`)

    try {
      const votingTransaction = req.body.votingTransaction as VotingTransaction
      if (!votingTransaction) {
        return res.status(401).json({ data: null, error: 'Unauthorized' } as ApiResponse<null>)
      }

      logger.info(
        `[SignRoute] Processing sign request for election ${votingTransaction.electionID} and voter ${votingTransaction.voterAddress}`,
      )

      const normalizedToken = normalizeHexString(
        votingTransaction.unblindedElectionToken.hexString.toLowerCase(),
      )
      const normalizedSig = normalizeHexString(
        votingTransaction.unblindedSignature.hexString.toLowerCase(),
      )
      const repository = dataSource.getRepository(VotingTransactionEntity)
      const existingRecord = await repository.findOne({
        where: {
          electionId: votingTransaction.electionID,
          unblindedElectionToken: normalizedToken,
          unblindedSignature: normalizedSig,
          encryptedVoteRsa: votingTransaction.encryptedVoteRSA.hexString,
          encryptedVoteAes: votingTransaction.encryptedVoteAES.hexString,
        },
      })

      if (existingRecord) {
        logger.info(
          `[SignRoute] Reusing existing SVS signature for election ${votingTransaction.electionID}`,
        )
        const svsSignature: EthSignature = { hexString: existingRecord.svsSignature }
        validateEthSignature(svsSignature)

        logger.info(
          `[SignRoute] Request completed (existing record) in ${Date.now() - startTime}ms`,
        )
        return res.status(200).json({
          data: { svsSignature },
          error: null,
        })
      }

      const signingKey = req.app.get('SVS_SIGN_KEY')
      if (!signingKey) {
        logger.error('[SignRoute] SVS signing key not configured')
        return res.status(500).json({
          data: null,
          error: 'Signing key not configured',
        } as ApiResponse<null>)
      }

      const signStartTime = Date.now()
      const svsSignature: EthSignature = await signVotingTransaction(votingTransaction, signingKey)
      logger.info(`[SignRoute] SVS signing completed in ${Date.now() - signStartTime}ms`)
      validateEthSignature(svsSignature)
      const upsertStartTime = Date.now()
      const result = await upsertVotingTransactionWithValidation(
        votingTransaction.electionID,
        normalizeEthAddress(votingTransaction.voterAddress),
        votingTransaction.encryptedVoteRSA.hexString,
        votingTransaction.encryptedVoteAES.hexString,
        normalizedToken,
        normalizedSig,
        svsSignature.hexString,
      )
      logger.info(
        `[SignRoute] Database upsert completed in ${Date.now() - upsertStartTime}ms — ${result.isNew ? 'created' : 'updated'}`,
      )

      logger.info(`[SignRoute] Request completed successfully in ${Date.now() - startTime}ms`)
      return res.status(200).json({
        data: { svsSignature },
        error: null,
      })
    } catch (error) {
      logger.error('Error signing token:', error)
      res.status(500).json({
        data: null,
        error: 'Internal server error',
      } as ApiResponse<null>)
    }
  },
)

export default router
