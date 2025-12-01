import dotenv from 'dotenv'
dotenv.config()

import { BlindedSignatureService } from '../services/blindedSignatureService'
import opnvoteAbi from '../abi/opnvote-0.1.0.json'
import { ethers } from 'ethers'
import { logger } from '../utils/logger'
import {
  TX_MULTIPLIERS,
  TX_LIMITS,
  WALLET_THRESHOLDS,
  MAX_CACHE_ENTRIES,
} from '../config/constants'
import { fetchRecentRegistrations, RecentRegistrationResponse } from '../graphql/graphqlClient'

const OPNVOTE_CONTRACT_ADDRESS = process.env.OPNVOTE_CONTRACT_ADDRESS
const RPC_PROVIDER = process.env.RPC_PROVIDER
const PRIVATE_KEY = process.env.PRIVATE_KEY
const MAX_FEE_PER_GAS_IN_GWEI = process.env.MAX_FEE_PER_GAS_IN_GWEI
const MAX_PRIORITY_FEE_PER_GAS_IN_GWEI = process.env.MAX_PRIORITY_FEE_PER_GAS_IN_GWEI

if (
  !process.env.BATCH_SIZE ||
  !OPNVOTE_CONTRACT_ADDRESS ||
  !RPC_PROVIDER ||
  !PRIVATE_KEY ||
  !MAX_FEE_PER_GAS_IN_GWEI ||
  !MAX_PRIORITY_FEE_PER_GAS_IN_GWEI
) {
  throw new Error(
    'BATCH_SIZE and OPNVOTE_CONTRACT_ADDRESS and RPC_PROVIDER and PRIVATE_KEY and MAX_FEE_PER_GAS_IN_GWEI and MAX_PRIORITY_FEE_PER_GAS_IN_GWEI must be set',
  )
}
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE!)

// Validate BATCH_SIZE is a positive number
if (isNaN(BATCH_SIZE) || BATCH_SIZE <= 1) {
  throw new Error('BATCH_SIZE too low')
}

//  sanity check
if (
  ethers.parseUnits(MAX_FEE_PER_GAS_IN_GWEI!, 'gwei') > TX_LIMITS.MAX_FEE_PER_GAS_SANITY_CHECK ||
  ethers.parseUnits(MAX_PRIORITY_FEE_PER_GAS_IN_GWEI!, 'gwei') >
    TX_LIMITS.MAX_PRIORITY_FEE_PER_GAS_SANITY_CHECK
) {
  throw new Error('MAX_FEE_PER_GAS_IN_GWEI or MAX_PRIORITY_FEE_PER_GAS_IN_GWEI is too high')
}

const provider = new ethers.JsonRpcProvider(RPC_PROVIDER)
const wallet = new ethers.Wallet(PRIVATE_KEY!, provider)
const contract = new ethers.Contract(OPNVOTE_CONTRACT_ADDRESS!, opnvoteAbi, wallet)

interface RegistrationCache {
  electionId: number
  voterIds: bigint[]
  blindedSignatures: string[]
  blindedElectionTokens: string[]
  batchId?: string
}

const registrationCacheMemory: RegistrationCache[] = []

/**
 * Maintains the cache size by removing oldest entries when exceeding CACHE_SIZE
 */
function maintainCacheSize(): void {
  if (registrationCacheMemory.length > MAX_CACHE_ENTRIES) {
    const itemsToRemove = registrationCacheMemory.length - MAX_CACHE_ENTRIES
    registrationCacheMemory.splice(0, itemsToRemove)
    logger.debug(`Removed ${itemsToRemove} old entries from memory cache`)
  }
}

/**
 * Checks if a registration has already been processed by looking through the cache
 * @param electionId - The election Id to check
 * @param voterId - The voter Id to check
 * @param blindedSignature - The blinded signature to check
 * @param blindedToken - The blinded token to check
 * @param registrationCache - The registration cache to check
 * @returns true if the registration has been processed, false otherwise
 */
function isRegistrationProcessed(
  electionId: number,
  voterId: bigint,
  blindedSignature: string,
  blindedToken: string,
  registrationCache: RegistrationCache[] | undefined = undefined,
): boolean {
  if (!registrationCache) {
    registrationCache = registrationCacheMemory
  }

  return registrationCache.some(batch => {
    if (batch.electionId !== electionId) {
      return false
    }
    const normalizedSignature = blindedSignature.toLowerCase()
    const normalizedToken = blindedToken.toLowerCase()
    return (
      batch.voterIds.includes(voterId) ||
      batch.blindedSignatures.includes(normalizedSignature) ||
      batch.blindedElectionTokens.includes(normalizedToken)
    )
  })
}

async function init() {
  const balance = await withRetry(() => provider.getBalance(wallet.address))
  const isBalanceSufficient = validateBalance(balance)
  if (!isBalanceSufficient) {
    throw new Error('Insufficient balance')
  }
}

init()

let isProcessing = false

/**
 * On-chain registration of pending registrations
 *
 * @returns
 */
export async function processPendingRegistrations(): Promise<void> {
  if (isProcessing) {
    logger.info('Already processing pending Registrations, skipping')
    return
  }

  isProcessing = true
  try {
    logger.debug('Processing pending Registrations...')
    const balance = await withRetry(() => provider.getBalance(wallet.address))
    const isBalanceSufficient = validateBalance(balance)
    if (!isBalanceSufficient) {
      logger.error(`Aborting due to insufficient balance`)
      return
    }

    const pendingRegistrations = await BlindedSignatureService.getPendingRegistrations()
    if (pendingRegistrations.length === 0) {
      logger.info(`No pending registrations found`)
      return
    }

    maintainCacheSize()

    const memoryFilteredRegistrations = pendingRegistrations.filter(
      registration =>
        !isRegistrationProcessed(
          registration.electionId,
          BigInt(registration.voterId),
          registration.blindedSignature,
          registration.blindedToken,
          registrationCacheMemory,
        ),
    )

    if (memoryFilteredRegistrations.length === 0) {
      logger.info(`All pending registrations have been processed already`)
      return
    }

    if (memoryFilteredRegistrations.length !== pendingRegistrations.length) {
      const memoryFilteredIds = memoryFilteredRegistrations
        .map(r => `(Voter: ${r.voterId}, Election: ${r.electionId})`)
        .join(', ')
      const pendingIds = pendingRegistrations
        .map(r => `(Voter: ${r.voterId}, Election: ${r.electionId})`)
        .join(', ')

      logger.error(
        `Found registrations that were already processed on-chain.\nMemory Filtered: ${memoryFilteredIds}\nPending: ${pendingIds}`,
      )
    }

    // Get all unique election Ids from pending registrations
    const electionIds: number[] = [
      ...new Set(memoryFilteredRegistrations.map(reg => reg.electionId)),
    ]

    const idList = memoryFilteredRegistrations
      .map(reg => `(Voter: ${reg.voterId}, Election: ${reg.electionId})`)
      .join(', ')
    logger.info(
      `Found ${memoryFilteredRegistrations.length} pending registrations for ${electionIds.length} elections: ${idList}`,
    )

    for (const electionId of electionIds) {
      let recentGraphRegistrations: RegistrationCache[] | null = null

      try {
        logger.debug(`Fetching recent registrations from The-Graph for election ${electionId}`)

        const recentRegistrations: RecentRegistrationResponse = await fetchRecentRegistrations(
          electionId.toString(),
          10,
        )
        recentGraphRegistrations = recentRegistrations.votersRegistereds.map(reg => ({
          electionId: electionId,
          voterIds: reg.voterIds.map(voterId => BigInt(voterId)),
          blindedSignatures: reg.blindedSignatures.map(sig => sig.toLowerCase()),
          blindedElectionTokens: reg.blindedElectionTokens.map(token => token.toLowerCase()),
        }))
        logger.debug(
          `Fetched ${recentGraphRegistrations.length} registration transactions from The-Graph for election ${electionId}`,
        )
      } catch (error) {
        logger.error(`Error fetching recent registrations from The-Graph: ${error}`)
        logger.warn(`Proceeding without on-chain verification for election ${electionId}`)
      }

      try {
        const pendingRegistrationsForElection = memoryFilteredRegistrations.filter(
          reg => reg.electionId === electionId,
        )

        let finalFilteredRegistrations = pendingRegistrationsForElection
        if (recentGraphRegistrations) {
          finalFilteredRegistrations = pendingRegistrationsForElection.filter(
            reg =>
              !isRegistrationProcessed(
                reg.electionId,
                BigInt(reg.voterId),
                reg.blindedSignature,
                reg.blindedToken,
                recentGraphRegistrations,
              ),
          )
          if (finalFilteredRegistrations.length !== pendingRegistrationsForElection.length) {
            const finalFilteredIds = finalFilteredRegistrations
              .map(r => `(Voter: ${r.voterId}, Election: ${r.electionId})`)
              .join(', ')
            const pendingIds = pendingRegistrationsForElection
              .map(r => `(Voter: ${r.voterId}, Election: ${r.electionId})`)
              .join(', ')
            logger.error(
              `Found registrations that were already processed on-chain.\nFinal Filtered: ${finalFilteredIds}\nPending: ${pendingIds}`,
            )
          }
        }

        logger.debug(
          `Filtered ${pendingRegistrationsForElection.length} -> ${finalFilteredRegistrations.length} registrations for election ${electionId}`,
        )

        logger.info(
          `Processing ${finalFilteredRegistrations.length} registrations for election ${electionId}`,
        )
        if (finalFilteredRegistrations.length === 0) {
          logger.error(`No new registrations found for election ${electionId}`)
          continue
        }

        // Split registrations into batches
        const registrationBatches = splitIntoBatches(finalFilteredRegistrations, BATCH_SIZE)
        logger.info(
          `Split into ${registrationBatches.length} batches with max size of ${BATCH_SIZE}`,
        )

        // Process each batch
        for (let batchIndex = 0; batchIndex < registrationBatches.length; batchIndex++) {
          const registrationBatch = registrationBatches[batchIndex]
          logger.info(
            `Processing batch ${batchIndex + 1}/${registrationBatches.length} with ${
              registrationBatch.length
            } registrations`,
          )

          const voterIds: bigint[] = []
          const blindedSignatures: string[] = []
          const blindedElectionTokens: string[] = []

          registrationBatch.forEach(registration => {
            voterIds.push(BigInt(registration.voterId))
            blindedSignatures.push(registration.blindedSignature.toLowerCase())
            blindedElectionTokens.push(registration.blindedToken.toLowerCase())
          })

          logger.info(
            `Preparing to register ${
              voterIds.length
            } voters for election Id: ${electionId} (batch ${batchIndex + 1}/${
              registrationBatches.length
            })`,
          )
          const feeData = await withRetry(() => provider.getFeeData())
          const maxFeePerGas = feeData.maxFeePerGas
          const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas

          if (!maxFeePerGas || !maxPriorityFeePerGas) {
            throw new Error('Max fee per gas or max priority fee per gas not found. Node down?')
          }

          const MIN_PRIORITY_FEE = ethers.parseUnits('1', 'gwei')
          const adjustedMaxPriorityFeePerGas =
            maxPriorityFeePerGas < MIN_PRIORITY_FEE
              ? MIN_PRIORITY_FEE
              : (maxPriorityFeePerGas * TX_MULTIPLIERS.MAX_PRIORITY_FEE_PERCENTAGE) / 100n

          let adjustedMaxFeePerGas = (maxFeePerGas * TX_MULTIPLIERS.MAX_FEE_PERCENTAGE) / 100n

          const block = await withRetry(() => provider.getBlock('latest'))
          if (!block || !block.baseFeePerGas) {
            throw new Error('Could not get baseFeePerGas')
          }

          const fallbackCap = block.baseFeePerGas * 2n + adjustedMaxPriorityFeePerGas
          if (adjustedMaxFeePerGas < fallbackCap) {
            adjustedMaxFeePerGas = fallbackCap
          }

          logger.info('Transaction Gas Fees', {
            baseFeePerGas: ethers.formatUnits(block.baseFeePerGas, 'gwei'),
            maxFeePerGas: ethers.formatUnits(maxFeePerGas, 'gwei'),
            maxPriorityFeePerGas: ethers.formatUnits(maxPriorityFeePerGas, 'gwei'),
            adjustedMaxFeePerGas: ethers.formatUnits(adjustedMaxFeePerGas, 'gwei'),
            adjustedMaxPriorityFeePerGas: ethers.formatUnits(adjustedMaxPriorityFeePerGas, 'gwei'),
          })

          if (
            adjustedMaxFeePerGas > ethers.parseUnits(MAX_FEE_PER_GAS_IN_GWEI!, 'gwei') ||
            adjustedMaxPriorityFeePerGas >
              ethers.parseUnits(MAX_PRIORITY_FEE_PER_GAS_IN_GWEI!, 'gwei')
          ) {
            logger.error(
              `Max fee per gas or max priority fee per gas is too high. MAX_FEE_PER_GAS: ${MAX_FEE_PER_GAS_IN_GWEI} | MAX_PRIORITY_FEE_PER_GAS: ${MAX_PRIORITY_FEE_PER_GAS_IN_GWEI}`,
            )
            throw new Error('Max fee per gas or max priority fee per gas is too high')
          }

          const estimatedGas = await withRetry(() =>
            contract.registerVoters.estimateGas(
              BigInt(electionId),
              voterIds,
              blindedSignatures,
              blindedElectionTokens,
              {
                maxFeePerGas: adjustedMaxFeePerGas,
                maxPriorityFeePerGas: adjustedMaxPriorityFeePerGas,
              },
            ),
          )
          const gasLimitWithBuffer = (estimatedGas * TX_MULTIPLIERS.GAS_LIMIT_PERCENTAGE) / 100n

          logger.info('Gas estimation', {
            estimatedGas: estimatedGas.toString(),
            gasLimitWithBuffer: gasLimitWithBuffer.toString(),
          })

          // Create and send transaction
          const tx: ethers.TransactionResponse = await contract.registerVoters(
            BigInt(electionId),
            voterIds,
            blindedSignatures,
            blindedElectionTokens,
            {
              maxFeePerGas: adjustedMaxFeePerGas,
              maxPriorityFeePerGas: adjustedMaxPriorityFeePerGas,
              gasLimit: gasLimitWithBuffer,
            },
          )
          logger.info(`Transaction sent: ${tx.hash}`)

          // Generate a batch Id for this group of registrations
          const batchId = `batch-${Date.now()}-${electionId}-${batchIndex}`

          registrationCacheMemory.push({
            electionId,
            voterIds,
            blindedSignatures,
            blindedElectionTokens,
            batchId,
          })

          // Update all registrations to 'submitted' status
          for (const registration of registrationBatch) {
            await BlindedSignatureService.updateRegistrationStatus(
              registration.voterId,
              registration.electionId,
              'submitted',
              tx.hash,
              batchId,
            )
            logger.debug(
              `Updated registration (Voter: ${registration.voterId}, Election: ${registration.electionId}) to submitted status`,
            )
          }

          try {
            const receipt = await waitForTransaction(tx, TX_LIMITS.DEFAULT_TX_TIMEOUT)
            if (!receipt || receipt.status !== 1) {
              logger.error(`Transaction failed: ${tx.hash} batchId: ${batchId}`)
              throw new Error(`Transaction failed: ${tx.hash}`)
            }
            logger.info(`Transaction successfully confirmed`, {
              electionId,
              txHash: tx.hash,
              batchId,
              voterCount: voterIds.length,
            })
            for (const registration of registrationBatch) {
              await BlindedSignatureService.updateRegistrationStatus(
                registration.voterId,
                registration.electionId,
                'confirmed',
                tx.hash,
                batchId,
              )
              logger.debug(
                `Updated registration (Voter: ${registration.voterId}, Election: ${registration.electionId}) to confirmed status`,
              )
            }
          } catch (error) {
            logger.error('Transaction failed or timeout reached:', error)
            for (const registration of registrationBatch) {
              await BlindedSignatureService.updateRegistrationStatus(
                registration.voterId,
                registration.electionId,
                'failed',
                tx.hash,
                batchId,
              )
              logger.debug(
                `Updated registration (Voter: ${registration.voterId}, Election: ${registration.electionId}) to failed status`,
              )
            }
          } finally {
            await timeout(30000) // 30 seconds timeout to not hit any rate limits
          }
        }
      } catch (error) {
        logger.error(`Error processing pending Registrations with electionId: ${electionId}`, error)
        await timeout(30000) // 30 seconds timeout for potential node recovery
      }
    }
  } catch (error) {
    logger.error(`Error processing pending Registrations: ${error}`)
  } finally {
    isProcessing = false
    await timeout(30000) // 30 seconds timeout to not hit any rate limits
  }
}

/**
 * Waits for a given amount of time
 * @param ms - The amount of time to wait
 */
async function timeout(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Executes a rpc-request with exp backoff on timeouts
 * @param fn - The function to execute
 * @param maxRetries - Maximum number of retries
 * @param baseDelayMs - Initial delay
 * @returns The result of fn
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelayMs = 1000): Promise<T> {
  let lastError: any
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      const isTimeout = error?.code === 'TIMEOUT' || error?.message?.includes('timeout')
      if (!isTimeout || attempt === maxRetries) {
        throw error
      }
      lastError = error
      const delay = baseDelayMs * Math.pow(2, attempt) // 1s, 2s, 4s
      logger.warn(`RPC call timeout, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
      await timeout(delay)
    }
  }
  throw lastError
}

/**
 * Waits for a transaction to be confirmed
 * @param tx - The transaction to wait for
 * @param timeoutMs - The timeout for the transaction
 * @returns The transaction receipt or null if the transaction failed
 */
async function waitForTransaction(
  tx: ethers.TransactionResponse,
  timeoutMs = TX_LIMITS.DEFAULT_TX_TIMEOUT,
): Promise<ethers.TransactionReceipt | null> {
  return Promise.race([
    tx.wait(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Transaction timeout exceeded')), timeoutMs),
    ),
  ])
}

/**
 * Validates the balance of the wallet
 * @param balance - The balance of the wallet
 * @returns true if the balance is sufficient, false otherwise
 */
function validateBalance(balance: bigint): boolean {
  if (balance < WALLET_THRESHOLDS.MINIMUM_BALANCE) {
    logger.error(`Insufficient balance: ${ethers.formatEther(balance)} Wallet: ${wallet.address}`)
    return false
  } else if (balance < WALLET_THRESHOLDS.LOW_BALANCE) {
    logger.warn(
      `Register Wallet Balance is low: ${ethers.formatEther(balance)} Wallet: ${wallet.address}`,
    )
    return true
  } else {
    logger.info(`Register Wallet Balance: ${ethers.formatEther(balance)} Wallet: ${wallet.address}`)
    return true
  }
}

/**
 * Splits an array into batches of specified size
 * @param items - The array to split
 * @param batchSize - The size of each batch
 * @returns An array of batches
 */
function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }
  return batches
}
