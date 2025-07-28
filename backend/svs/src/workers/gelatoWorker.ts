import dotenv from 'dotenv'
import { dataSource } from '../database'
import { GelatoQueueEntity } from '../models/GelatoQueue'
import { GelatoRelay, RelayResponse, TransactionStatusResponse } from '@gelatonetwork/relay-sdk'
import { GelatoQueueStatus } from '../types/gelato'
import { LessThan, Repository } from 'typeorm'
import { getEnvVar, getErrorMessage, truncateErrorMessage } from '../utils/utils'
import { logger } from '../utils/logger'

dotenv.config()

const RATE_LIMIT = getEnvVar<number>('GELATO_RATE_LIMIT', 'number')
const PROCESSING_INTERVAL = getEnvVar<number>('GELATO_PROCESSING_INTERVAL', 'number')
const MAX_RETRIES = getEnvVar<number>('GELATO_MAX_RETRIES', 'number')
const RETRY_DELAY = getEnvVar<number>('GELATO_RETRY_DELAY', 'number')
const MAX_FAILURE_REASON_LENGTH = 255
const STATUS_UPDATE_INTERVAL = getEnvVar<number>('GELATO_STATUS_UPDATE_INTERVAL', 'number')

export enum TaskState {
  CheckPending = 'CheckPending',
  ExecPending = 'ExecPending',
  ExecSuccess = 'ExecSuccess',
  ExecReverted = 'ExecReverted',
  WaitingForConfirmation = 'WaitingForConfirmation',
  Blacklisted = 'Blacklisted',
  Cancelled = 'Cancelled',
  NotFound = 'NotFound',
}

export async function startGelatoWorker() {
  const gelatoRelay = new GelatoRelay()
  const repository = dataSource.getRepository(GelatoQueueEntity)

  // Submission Interval
  setInterval(async () => {
    await processPendingRequests(gelatoRelay, repository)
  }, PROCESSING_INTERVAL)

  // Status Update Interval
  setInterval(async () => {
    await updateTaskStates(gelatoRelay, repository)
  }, STATUS_UPDATE_INTERVAL)
}

export async function processPendingRequests(
  gelatoRelay: GelatoRelay,
  repository: Repository<GelatoQueueEntity>,
) {
  try {
    const pendingRequests = await repository.find({
      where: [
        { status: GelatoQueueStatus.QUEUED },
        { status: GelatoQueueStatus.RETRY, retryAt: LessThan(new Date()) },
      ],
      take: RATE_LIMIT,
      order: { createdAt: 'ASC' },
    })

    for (const request of pendingRequests) {
      request.status = GelatoQueueStatus.PROCESSING
      await repository.save(request)

      try {
        const signatureData = JSON.parse(request.signatureData)
        const sponsorApiKey = process.env.GELATO_SPONSOR_API_KEY

        if (!sponsorApiKey) {
          throw new Error('Gelato Sponsor API key not configured')
        }
        const relayResponse: RelayResponse = await gelatoRelay.sponsoredCallERC2771WithSignature(
          signatureData.struct,
          signatureData.signature,
          sponsorApiKey,
        )

        request.status = GelatoQueueStatus.SUBMITTED
        request.gelatoTaskId = relayResponse.taskId
        request.failureReason = null
        await repository.save(request)

        logger.info(
          `[Task ID: ${relayResponse.taskId}] Request ${request.requestHash} submitted successfully after ${request.retryCount} retries.`,
        )
      } catch (error) {
        logger.error(
          `[Task ID: ${
            request.gelatoTaskId || 'N/A'
          }] Error processing Gelato request (Request Hash: ${request.requestHash}):`,
          error,
        )
        const errorMessage = truncateErrorMessage(getErrorMessage(error), MAX_FAILURE_REASON_LENGTH)
        if (request.retryCount < MAX_RETRIES) {
          request.status = GelatoQueueStatus.RETRY
          request.retryCount += 1
          request.retryAt = new Date(Date.now() + RETRY_DELAY)
          request.failureReason = errorMessage
          logger.info(
            `[Task ID: ${request.gelatoTaskId || 'N/A'}] Request ${
              request.requestHash
            } marked for retry (${request.retryCount}/${MAX_RETRIES}).`,
          )
        } else {
          request.status = GelatoQueueStatus.FAILED
          request.failureReason = truncateErrorMessage(
            `Max retries (${MAX_RETRIES}) reached. Last error: ${errorMessage}`,
            MAX_FAILURE_REASON_LENGTH,
          )
          logger.info(
            `[Task ID: ${request.gelatoTaskId || 'N/A'}] Request ${
              request.requestHash
            } failed after maximum retries.`,
          )
        }
        await repository.save(request)
      }
    }
  } catch (error) {
    logger.error('Error in Gelato worker during processing:', error)
  }
}

export async function updateTaskStates(
  gelatoRelay: GelatoRelay,
  repository: Repository<GelatoQueueEntity>,
) {
  try {
    const submittedTasks = await repository.find({
      where: { status: GelatoQueueStatus.SUBMITTED },
      take: RATE_LIMIT,
    })

    for (const task of submittedTasks) {
      if (task.gelatoTaskId) {
        try {
          const statusResponse: TransactionStatusResponse | undefined =
            await gelatoRelay.getTaskStatus(task.gelatoTaskId)
          if (statusResponse === undefined) {
            logger.error(`[Task ID: ${task.gelatoTaskId}] Couldn't get status response.`)
            continue
          }

          const taskState = statusResponse.taskState
          switch (taskState) {
            case TaskState.ExecSuccess:
              task.status = GelatoQueueStatus.CONFIRMED
              break
            case TaskState.ExecReverted:
            case TaskState.Cancelled:
              if (task.retryCount < MAX_RETRIES) {
                task.status = GelatoQueueStatus.RETRY
                task.retryCount += 1
                task.retryAt = new Date(Date.now() + RETRY_DELAY)
                task.failureReason = truncateErrorMessage(
                  `Max retries (${MAX_RETRIES}) reached. Last error: ${
                    statusResponse.lastCheckMessage || 'Unknown error'
                  }`,
                  MAX_FAILURE_REASON_LENGTH,
                )
                logger.info(
                  `[Task ID: ${task.gelatoTaskId}] Marked for retry (${task.retryCount}/${MAX_RETRIES}).`,
                )
              } else {
                task.status = GelatoQueueStatus.FAILED
                task.failureReason = truncateErrorMessage(
                  `Max retries (${MAX_RETRIES}) reached. Last error: ${
                    statusResponse.lastCheckMessage || 'Unknown error'
                  }`,
                  MAX_FAILURE_REASON_LENGTH,
                )
                logger.info(`[Task ID: ${task.gelatoTaskId}] Failed after maximum retries.`)
              }
              break
            case TaskState.CheckPending:
            case TaskState.ExecPending:
            case TaskState.WaitingForConfirmation:
              // Do nothing
              break
            default:
              logger.error(`[Task ID: ${task.gelatoTaskId}] Unhandled task state "${taskState}".`)
              break
          }

          if (task.status !== GelatoQueueStatus.SUBMITTED) {
            await repository.save(task)
            logger.info(`[Task ID: ${task.gelatoTaskId}] Status updated to ${task.status}.`)
          }
        } catch (error) {
          logger.error(`[Task ID: ${task.gelatoTaskId}] Error fetching status:`, error)
        }
      }
    }
  } catch (error) {
    logger.error('Error in Gelato worker during status updates:', error)
  }
}
