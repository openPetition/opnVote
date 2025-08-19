import { Request, Response, Router } from 'express'
import { ethers } from 'ethers'
import {
  GelatoRelay,
  RelayResponse,
  SignatureData,
  TransactionStatusResponse,
} from '@gelatonetwork/relay-sdk'
import { normalizeEthAddress } from 'votingsystem'
import { ApiResponse } from '../types/apiResponses'
import { dataSource } from '../database'
import { GelatoQueueEntity } from '../models/GelatoQueue'
import { GelatoQueueStatus } from '../types/gelato'
import { checkEligibility } from '../middleware/checkEligibility'
import { checkForwardLimit } from '../middleware/checkForwardLimit'
import { checkEthCall } from '../middleware/checkEthCall'
import { logger } from '../utils/logger'

const router = Router()
const GELATO_USE_QUEUE_ERROR = 'GELATO_USE_QUEUE is not set in the environment variables.'

/**
 * @openapi
 * /api/gelato/forward:
 *   post:
 *     summary: Forwards a transaction to Gelato network
 *     description: Validates and forwards the transaction either directly to Gelato relay or to an internal queue for processing
 *     tags: [Gelato Relay]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignatureData'
 *     responses:
 *       200:
 *         description: Request successfully handled (either forwarded or queued)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: null
 *                 error:
 *                   type: string
 *                   example: "Bad request: Invalid calldata"
 *       500:
 *         description: Server configuration error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: null
 *                 error:
 *                   type: string
 *                   example: "GELATO_USE_QUEUE is not set in the environment variables"
 */
router.post(
  '/forward',
  checkEligibility, // Validates if the transaction is eligible for sponsorship
  checkEthCall, // Validates if the eth_call simulation succeeds
  checkForwardLimit, // Enforces per-user forwarding rate limits
  async (req: Request, res: Response) => {
    const startTime = Date.now()
    try {
      logger.info(
        `[GelatoRoute] Starting forward request processing at ${new Date().toISOString()}`,
      )
      const signatureData = req.body as SignatureData
      const GELATO_USE_QUEUE = req.app.get('GELATO_USE_QUEUE')

      if (!signatureData?.struct || !signatureData.signature) {
        logger.warn('[GelatoRoute] Missing required signature data')
        return res.status(400).json({
          data: null,
          error: 'Bad request: Missing required signature data',
        })
      }
      const userAddress = normalizeEthAddress(signatureData.struct.user)
      logger.info(`[GelatoRoute] Processing request for user: ${userAddress}`)

      if (GELATO_USE_QUEUE === undefined) {
        logger.error('[GelatoRoute] GELATO_USE_QUEUE not configured')
        return res.status(500).json({
          data: null,
          error: GELATO_USE_QUEUE_ERROR,
        })
      }

      if (GELATO_USE_QUEUE) {
        logger.info(`[GelatoRoute] Queueing request for user: ${userAddress}`)
        const repository = dataSource.getRepository(GelatoQueueEntity)
        // Generate a unique requestHash
        const timestamp = Date.now().toString()
        const requestHash = ethers.id(JSON.stringify(signatureData) + timestamp)

        const queueEntry = new GelatoQueueEntity()
        queueEntry.signatureData = JSON.stringify(signatureData)
        queueEntry.status = GelatoQueueStatus.QUEUED
        queueEntry.requestHash = requestHash
        queueEntry.gelatoUserAddress = userAddress
        await repository.save(queueEntry)
        logger.info(`[GelatoRoute] Successfully queued request with hash: ${requestHash}`)

        return res.status(200).json({
          data: { requestHash },
          error: null,
        })
      } else {
        logger.info(`[GelatoRoute] Forwarding directly to Gelato for user: ${userAddress}`)
        // Forwarding directly to Gelato utilizing Gelato auto-scaling
        const sponsorApiKey = req.app.get('GELATO_SPONSOR_API_KEY')
        if (!sponsorApiKey) {
          logger.error('[GelatoRoute] Gelato Sponsor API key not configured')
          return res.status(500).json({
            data: null,
            error: 'Gelato Sponsor API key not configured',
          })
        }
        const gelatoRelay = req.app.get('gelatoRelay') as GelatoRelay
        logger.info(`[GelatoRoute] Calling Gelato relay for user: ${userAddress}`)

        // Retry with exponential backoff
        const maxRetries = 4
        let lastError: any

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const relayResponse: RelayResponse =
              await gelatoRelay.sponsoredCallERC2771WithSignature(
                signatureData.struct,
                signatureData.signature,
                sponsorApiKey,
              )
            logger.info(
              `[GelatoRoute] Successfully forwarded to Gelato on attempt ${attempt + 1}. Task ID: ${
                relayResponse.taskId
              }`,
            )

            return res.status(200).json({
              data: relayResponse,
              error: null,
            })
          } catch (error) {
            lastError = error

            if (attempt === maxRetries) {
              break
            }

            const delay = 400 * Math.pow(2, attempt) // 400ms, 800ms, 1600ms, 3200ms
            logger.warn(
              `[GelatoRoute] Gelato call attempt ${
                attempt + 1
              } failed, retrying in ${delay}ms. Error: ${error}`,
            )

            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }

        logger.error(
          `[GelatoRoute] All ${
            maxRetries + 1
          } attempts failed for Gelato relay call. Final error: ${lastError}`,
        )
        throw lastError
      }
    } catch (error) {
      const processingTime = Date.now() - startTime
      logger.error(
        `[GelatoRoute] Failed to process request after ${processingTime}ms. Error: ${error}`,
      )
      res.status(500).json({
        data: null,
        error: 'Failed to queue Gelato request',
      } as ApiResponse<null>)
    }
  },
)

/**
 * @openapi
 * /api/gelato/tasks/{taskId}:
 *   get:
 *     summary: Retrieves the status of a requested internal Gelato task
 *     tags: [Gelato Relay]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         schema:
 *           type: string
 *         required: true
 *         description: The unique identifier of the internal task (requestHash)
 *     responses:
 *       200:
 *         description: Task status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [QUEUED, PROCESSING, COMPLETED, FAILED]
 *                 gelatoTaskId:
 *                   type: string
 *                   nullable: true
 *                   description: "Gelato's task identifier once forwarded"
 *                 txHash:
 *                   type: string
 *                   nullable: true
 *                   description: "Transaction hash once processed"
 *                 retryCount:
 *                   type: number
 *                   description: "Number of retry attempts"
 *                 failureReason:
 *                   type: string
 *                   nullable: true
 *                   description: "Reason for failure if status is FAILED"
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Queue processing is not enabled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Queue processing is not enabled"
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Task not found"
 *       500:
 *         description: Server configuration error or internal error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "GELATO_USE_QUEUE is not set in the environment variables"
 */
router.get('/tasks/:taskId', async (req: Request, res: Response) => {
  const { taskId } = req.params
  try {
    const GELATO_USE_QUEUE = req.app.get('GELATO_USE_QUEUE')
    if (GELATO_USE_QUEUE === undefined) {
      return res.status(500).json({
        data: null,
        error: GELATO_USE_QUEUE_ERROR,
      })
    }

    if (!GELATO_USE_QUEUE) {
      return res.status(500).json({
        error: 'Queue processing is not enabled',
      })
    }

    const repository = dataSource.getRepository(GelatoQueueEntity)
    const task = await repository.findOne({ where: { requestHash: taskId } })

    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }

    const response = {
      status: task.status,
      gelatoTaskId: task.gelatoTaskId || null,
      txHash: task.txHash || null,
      retryCount: task.retryCount,
      failureReason: task.failureReason || null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }

    res.status(200).json(response)
  } catch (error) {
    logger.error('[GelatoRoute] Failed to retrieve task Error:', error)
    res.status(500).json({
      error: 'Failed to retrieve task',
    })
  }
})

/**
 * @openapi
 * /api/gelato/verify/{gelatoTaskId}:
 *   get:
 *     summary: Verifies status of an external Gelato task ID and returns both Gelato and on-chain status
 *     description: Takes an external Gelato task ID to verify its status
 *     tags: [Gelato Relay]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: gelatoTaskId
 *         schema:
 *           type: string
 *         required: true
 *         description: The external Gelato task ID to verify
 *     responses:
 *       200:
 *         description: Status verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 gelatoStatus:
 *                   type: string
 *                   description: "Current Gelato task status"
 *                 transactionHash:
 *                   type: string
 *                   nullable: true
 *                   description: "Transaction hash if available"
 *                 onChainStatus:
 *                   type: object
 *                   properties:
 *                     confirmed:
 *                       type: boolean
 *                       description: "Whether the transaction is confirmed on-chain"
 *                     blockNumber:
 *                       type: number
 *                       nullable: true
 *                       description: "Block number if confirmed"
 *                     status:
 *                       type: number
 *                       nullable: true
 *                       description: "Transaction status (1=success, 0=failed)"
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Task not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to verify task status"
 */
router.get('/verify/:gelatoTaskId', async (req: Request, res: Response) => {
  const { gelatoTaskId } = req.params

  try {
    logger.info(`[GelatoRoute] Verifying status for Gelato task ID: ${gelatoTaskId}`)

    const gelatoRelay = req.app.get('gelatoRelay') as GelatoRelay

    const statusResponse: TransactionStatusResponse | undefined = await gelatoRelay.getTaskStatus(
      gelatoTaskId,
    )

    if (statusResponse === undefined) {
      logger.error(`[GelatoRoute] Couldn't get status response for task: ${gelatoTaskId}`)
      return res.status(404).json({
        error: 'Task not found',
      })
    }

    const gelatoStatus = statusResponse.taskState
    const transactionHash = statusResponse.transactionHash || null

    let onChainStatus = {
      confirmed: false,
      blockNumber: null as number | null,
      status: null as number | null,
    }

    if (transactionHash) {
      try {
        const rpcProvider: ethers.JsonRpcProvider = req.app.get('rpcProvider')

        if (!rpcProvider) {
          logger.error(`[GelatoRoute] RPC provider not configured`)
          return res.status(500).json({
            error: 'RPC provider not configured',
          })
        }

        const receipt = await rpcProvider.getTransactionReceipt(transactionHash)

        if (receipt) {
          onChainStatus = {
            confirmed: true,
            blockNumber: receipt.blockNumber,
            status: receipt.status,
          }
          logger.info(
            `[GelatoRoute] Transaction ${transactionHash} confirmed on-chain in block ${receipt.blockNumber}`,
          )
        } else {
          logger.info(`[GelatoRoute] Transaction ${transactionHash} not yet confirmed on-chain`)
        }
      } catch (error) {
        logger.error(
          `[GelatoRoute] Error checking on-chain status for transaction ${transactionHash}:`,
          error,
        )
      }
    }

    const response = {
      gelatoStatus,
      transactionHash,
      onChainStatus,
    }

    logger.info(
      `[GelatoRoute] Successfully verified status for task ${gelatoTaskId}: ${gelatoStatus}`,
    )
    res.status(200).json(response)
  } catch (error) {
    logger.error(`[GelatoRoute] Failed to verify status for task ${gelatoTaskId}:`, error)
    res.status(500).json({
      error: 'Failed to verify task status',
    })
  }
})

export default router
