import dotenv from 'dotenv'
dotenv.config()

import { AuthorizationService } from '../services/authorizationService'
import opnvoteAbi from '../abi/opnvote-0.1.0.json'
import { ethers } from 'ethers'
import { logger } from '../utils/logger'
import {
  TX_MULTIPLIERS,
  TX_LIMITS,
  WALLET_THRESHOLDS,
  MAX_CACHE_ENTRIES,
} from '../config/constants'
import { fetchRecentAuthorizations, RecentAuthorizationResponse } from '../graphql/graphqlClient'

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

interface AuthorizationCache {
  voterIds: bigint[]
  electionId: number
  batchId?: string
}

const authorizationCacheMemory: AuthorizationCache[] = []

/**
 * Maintains the cache size by removing oldest entries when exceeding CACHE_SIZE
 */
function maintainCacheSize(): void {
  if (authorizationCacheMemory.length > MAX_CACHE_ENTRIES) {
    const itemsToRemove = authorizationCacheMemory.length - MAX_CACHE_ENTRIES
    authorizationCacheMemory.splice(0, itemsToRemove)
    logger.debug(`Removed ${itemsToRemove} old entries from memory cache`)
  }
}

/**
 * Checks if an authorization has already been processed by looking through the cache
 * @param electionId - The election Id to check
 * @param voterId - The voter Id to check
 * @param authorizationCache - The authorization cache to check
 * @returns true if the authorization has been processed, false otherwise
 */
function isAuthorizationProcessed(
  electionId: number,
  voterId: bigint,
  authorizationCache: AuthorizationCache[] | undefined = undefined,
): boolean {
  if (!authorizationCache) {
    authorizationCache = authorizationCacheMemory
  }

  return authorizationCache.some(batch => {
    if (batch.electionId !== electionId) {
      return false
    }
    return batch.voterIds.includes(voterId)
  })
}

async function init() {
  const balance = await provider.getBalance(wallet.address)
  const isBalanceSufficient = validateBalance(balance)
  if (!isBalanceSufficient) {
    throw new Error('Insufficient balance')
  }
}

init()

let isProcessing = false

/**
 * On-chain authorization of pending authorizations
 *
 * @returns
 */
export async function processPendingAuthorizations(): Promise<void> {
  if (isProcessing) {
    logger.info('Already processing pending authorizations, skipping')
    return
  }

  isProcessing = true
  try {
    logger.debug('Processing pending Authorizations...')
    const balance = await provider.getBalance(wallet.address)
    const isBalanceSufficient = validateBalance(balance)
    if (!isBalanceSufficient) {
      logger.error(`Aborting due to insufficient balance`)
      return
    }

    const pendingAuthorizations = await AuthorizationService.getPendingAuthorizations()
    if (pendingAuthorizations.length === 0) {
      logger.info(`No pending authorizations found`)
      return
    }

    maintainCacheSize()

    const memoryFilteredAuthorizations = pendingAuthorizations.filter(
      authorization =>
        !isAuthorizationProcessed(
          authorization.electionId,
          BigInt(authorization.voterId),
          authorizationCacheMemory,
        ),
    )

    if (memoryFilteredAuthorizations.length === 0) {
      logger.info(`All pending authorizations have been processed already`)
      return
    }

    if (memoryFilteredAuthorizations.length !== pendingAuthorizations.length) {
      const memoryFilteredIds = memoryFilteredAuthorizations
        .map(r => `(User: ${r.voterId}, Election: ${r.electionId})`)
        .join(', ')
      const pendingIds = pendingAuthorizations
        .map(r => `(User: ${r.voterId}, Election: ${r.electionId})`)
        .join(', ')

      logger.error(
        `Found authorizations that were already processed on-chain.\nMemory Filtered: ${memoryFilteredIds}\nPending: ${pendingIds}`,
      )
    }

    // Get all unique election IDs from pending authorizations
    const electionIds: number[] = [
      ...new Set(memoryFilteredAuthorizations.map(auth => auth.electionId)),
    ]

    const idList = memoryFilteredAuthorizations
      .map(auth => `(User: ${auth.voterId}, Election: ${auth.electionId})`)
      .join(', ')
    logger.info(
      `Found ${memoryFilteredAuthorizations.length} pending authorizations for ${electionIds.length} elections: ${idList}`,
    )

    for (const electionId of electionIds) {
      let recentGraphAuthorizations: AuthorizationCache[] | null = null

      try {
        logger.debug(`Fetching recent authorizations from The-Graph for election ${electionId}`)

        const recentAuthorizations: RecentAuthorizationResponse = await fetchRecentAuthorizations(
          electionId.toString(),
          10,
        )
        recentGraphAuthorizations = recentAuthorizations.votersAuthorizeds.map(auth => ({
          electionId: electionId,
          voterIds: auth.voterIds.map(voterId => BigInt(voterId)),
        }))
        logger.debug(
          `Fetched ${recentGraphAuthorizations.length} authorization transactions from The-Graph for election ${electionId}`,
        )
      } catch (error) {
        logger.error(`Error fetching recent authorizations from The-Graph: ${error}`)
        logger.warn(`Proceeding without on-chain verification for election ${electionId}`)
      }

      try {
        const pendingAuthorizationsForElection = memoryFilteredAuthorizations.filter(
          auth => auth.electionId === electionId,
        )

        let finalFilteredAuthorizations = pendingAuthorizationsForElection
        if (recentGraphAuthorizations) {
          finalFilteredAuthorizations = pendingAuthorizationsForElection.filter(
            auth =>
              !isAuthorizationProcessed(
                auth.electionId,
                BigInt(auth.voterId),
                recentGraphAuthorizations,
              ),
          )
          if (finalFilteredAuthorizations.length !== pendingAuthorizationsForElection.length) {
            const finalFilteredIds = finalFilteredAuthorizations
              .map(auth => `(User: ${auth.voterId}, Election: ${auth.electionId})`)
              .join(', ')
            const pendingIds = pendingAuthorizationsForElection
              .map(r => `(User: ${r.voterId}, Election: ${r.electionId})`)
              .join(', ')
            logger.error(
              `Found authorizations that were already processed on-chain.\nFinal Filtered: ${finalFilteredIds}\nPending: ${pendingIds}`,
            )
          }
        }

        logger.debug(
          `Filtered ${pendingAuthorizationsForElection.length} -> ${finalFilteredAuthorizations.length} authorizations for election ${electionId}`,
        )

        logger.info(
          `Processing ${finalFilteredAuthorizations.length} authorizations for election ${electionId}`,
        )
        if (finalFilteredAuthorizations.length === 0) {
          logger.error(`No new authorizations found for election ${electionId}`)
          continue
        }

        // Split authorizations into batches
        const authorizationBatches = splitIntoBatches(finalFilteredAuthorizations, BATCH_SIZE)
        logger.info(
          `Split into ${authorizationBatches.length} batches with max size of ${BATCH_SIZE}`,
        )

        // Process each batch
        for (let batchIndex = 0; batchIndex < authorizationBatches.length; batchIndex++) {
          const authorizationBatch = authorizationBatches[batchIndex]
          logger.info(
            `Processing batch ${batchIndex + 1}/${authorizationBatches.length} with ${
              authorizationBatch.length
            } authorizations`,
          )

          const voterIds: bigint[] = []

          authorizationBatch.forEach(auth => {
            voterIds.push(BigInt(auth.voterId))
          })

          logger.info(
            `Preparing to authorize ${
              voterIds.length
            } voters for election ID: ${electionId} (batch ${batchIndex + 1}/${
              authorizationBatches.length
            })`,
          )
          const feeData = await provider.getFeeData()
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

          const block = await provider.getBlock('latest')
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

          const estimatedGas = await contract.authorizeVoters.estimateGas(
            BigInt(electionId),
            voterIds,
            {
              maxFeePerGas: adjustedMaxFeePerGas,
              maxPriorityFeePerGas: adjustedMaxPriorityFeePerGas,
            },
          )
          const gasLimitWithBuffer = (estimatedGas * TX_MULTIPLIERS.GAS_LIMIT_PERCENTAGE) / 100n

          logger.info('Gas estimation', {
            estimatedGas: estimatedGas.toString(),
            gasLimitWithBuffer: gasLimitWithBuffer.toString(),
          })

          // Create and send transaction
          const tx: ethers.TransactionResponse = await contract.authorizeVoters(
            BigInt(electionId),
            voterIds,
            {
              maxFeePerGas: adjustedMaxFeePerGas,
              maxPriorityFeePerGas: adjustedMaxPriorityFeePerGas,
              gasLimit: gasLimitWithBuffer,
            },
          )
          logger.info(`Transaction sent: ${tx.hash}`)

          // Generate a batch ID for this group of authorizations
          const batchId = `batch-${Date.now()}-${electionId}-${batchIndex}`

          authorizationCacheMemory.push({
            electionId,
            voterIds,
            batchId,
          })

          // Update all authorizations to 'submitted' status
          for (const auth of authorizationBatch) {
            await AuthorizationService.updateAuthorizationStatus(
              auth.voterId,
              auth.electionId,
              'submitted',
              tx.hash,
              batchId,
            )
            logger.debug(
              `Updated authorization (User: ${auth.voterId}, Election: ${auth.electionId}) to submitted status`,
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
            for (const auth of authorizationBatch) {
              await AuthorizationService.updateAuthorizationStatus(
                auth.voterId,
                auth.electionId,
                'confirmed',
                tx.hash,
                batchId,
              )
              logger.debug(
                `Updated authorization (User: ${auth.voterId}, Election: ${auth.electionId}) to confirmed status`,
              )
            }
          } catch (error) {
            logger.error('Transaction failed or timeout reached:', error)
            for (const auth of authorizationBatch) {
              await AuthorizationService.updateAuthorizationStatus(
                auth.voterId,
                auth.electionId,
                'failed',
                tx.hash,
                batchId,
              )
              logger.debug(
                `Updated authorization (User: ${auth.voterId}, Election: ${auth.electionId}) to failed status`,
              )
            }
          } finally {
            await timeout(30000) // 30 seconds timeout to not hit any rate limits
          }
        }
      } catch (error) {
        logger.error(
          `Error processing pending Authorizations with electionId: ${electionId}`,
          error,
        )
        await timeout(30000) // 30 seconds timeout for potential node recovery
      }
    }
  } catch (error) {
    logger.error(`Error processing pending Authorizations: ${error}`)
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
      `Authorization Wallet Balance is low: ${ethers.formatEther(balance)} Wallet: ${
        wallet.address
      }`,
    )
    return true
  } else {
    logger.info(
      `Authorization Wallet Balance: ${ethers.formatEther(balance)} Wallet: ${wallet.address}`,
    )
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
