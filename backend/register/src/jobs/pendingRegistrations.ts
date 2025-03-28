import dotenv from 'dotenv';
dotenv.config();

import { BlindedSignatureService } from '../services/blindedSignatureService';
import opnvoteAbi from '../abi/opnvote-0.0.2.json';
import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { TX_MULTIPLIERS, TX_LIMITS, WALLET_THRESHOLDS, MAX_CACHE_ENTRIES } from '../config/constants';
import { fetchRecentRegistrations, RecentRegistrationResponse } from '../graphql/graphqlClient';

const OPNVOTE_CONTRACT_ADDRESS = process.env.OPNVOTE_CONTRACT_ADDRESS;
const RPC_PROVIDER = process.env.RPC_PROVIDER;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const MAX_FEE_PER_GAS_IN_GWEI = process.env.MAX_FEE_PER_GAS_IN_GWEI;
const MAX_PRIORITY_FEE_PER_GAS_IN_GWEI = process.env.MAX_PRIORITY_FEE_PER_GAS_IN_GWEI;

if (!process.env.BATCH_SIZE || !OPNVOTE_CONTRACT_ADDRESS || !RPC_PROVIDER || !PRIVATE_KEY || !MAX_FEE_PER_GAS_IN_GWEI || !MAX_PRIORITY_FEE_PER_GAS_IN_GWEI) {
  throw new Error('BATCH_SIZE and OPNVOTE_CONTRACT_ADDRESS and RPC_PROVIDER and PRIVATE_KEY and MAX_FEE_PER_GAS_IN_GWEI and MAX_PRIORITY_FEE_PER_GAS_IN_GWEI must be set');
}
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE!)

// Validate BATCH_SIZE is a positive number
if (isNaN(BATCH_SIZE) || BATCH_SIZE <= 1) {
  throw new Error('BATCH_SIZE too low');
}

//  sanity check
if (ethers.parseUnits(MAX_FEE_PER_GAS_IN_GWEI!, "gwei") > TX_LIMITS.MAX_FEE_PER_GAS_SANITY_CHECK || ethers.parseUnits(MAX_PRIORITY_FEE_PER_GAS_IN_GWEI!, "gwei") > TX_LIMITS.MAX_PRIORITY_FEE_PER_GAS_SANITY_CHECK) {
  throw new Error('MAX_FEE_PER_GAS_IN_GWEI or MAX_PRIORITY_FEE_PER_GAS_IN_GWEI is too high');
}

const provider = new ethers.JsonRpcProvider(RPC_PROVIDER);
const wallet = new ethers.Wallet(PRIVATE_KEY!, provider);
const contract = new ethers.Contract(OPNVOTE_CONTRACT_ADDRESS!, opnvoteAbi, wallet);

interface RegistrationCache {
  electionID: number;
  voterIDs: bigint[];
  blindedSignatures: string[];
  blindedElectionTokens: string[];
  batchID?: string;
}

const registrationCacheMemory: RegistrationCache[] = [];

/**
 * Maintains the cache size by removing oldest entries when exceeding CACHE_SIZE
 */
function maintainCacheSize(): void {
  if (registrationCacheMemory.length > MAX_CACHE_ENTRIES) {
    const itemsToRemove = registrationCacheMemory.length - MAX_CACHE_ENTRIES;
    registrationCacheMemory.splice(0, itemsToRemove);
    logger.debug(`Removed ${itemsToRemove} old entries from memory cache`);
  }
}

/**
 * Checks if a registration has already been processed by looking through the cache
 * @param electionID - The election ID to check
 * @param voterID - The voter ID to check
 * @param blindedSignature - The blinded signature to check
 * @param blindedToken - The blinded token to check
 * @param registrationCache - The registration cache to check
 * @returns true if the registration has been processed, false otherwise
 */
function isRegistrationProcessed(
  electionID: number,
  voterID: bigint,
  blindedSignature: string,
  blindedToken: string,
  registrationCache: RegistrationCache[] | undefined = undefined
): boolean {

  if (!registrationCache) {
    registrationCache = registrationCacheMemory;
  }

  return registrationCache.some(batch => {
    if (batch.electionID !== electionID) {
      return false;
    }
    const normalizedSignature = blindedSignature.toLowerCase();
    const normalizedToken = blindedToken.toLowerCase();
    return (
      batch.voterIDs.includes(voterID) ||
      batch.blindedSignatures.includes(normalizedSignature) ||
      batch.blindedElectionTokens.includes(normalizedToken)
    );
  });
}


async function init() {
  const balance = await provider.getBalance(wallet.address);
  const isBalanceSufficient = validateBalance(balance);
  if (!isBalanceSufficient) {
    throw new Error('Insufficient balance');
  }
}

init();

let isProcessing = false;

/**
 * On-chain registration of pending registrations
 * 
 * @returns 
 */
export async function processPendingRegistrations(): Promise<void> {
  if (isProcessing) {
    logger.info('Already processing pending Registrations, skipping');
    return;
  }

  isProcessing = true;
  try {

    logger.debug('Processing pending Registrations...');
    const balance = await provider.getBalance(wallet.address);
    const isBalanceSufficient = validateBalance(balance);
    if (!isBalanceSufficient) {
      logger.error(`Aborting due to insufficient balance`);
      return;
    }

    const pendingRegistrations = await BlindedSignatureService.getPendingRegistrations();
    if (pendingRegistrations.length === 0) {
      logger.info(`No pending registrations found`);
      return;
    }

    maintainCacheSize();

    const memoryFilteredRegistrations = pendingRegistrations.filter(registration => !isRegistrationProcessed(
      registration.electionID,
      BigInt(registration.userID),
      registration.blindedSignature,
      registration.blindedToken,
      registrationCacheMemory
    ));

    if (memoryFilteredRegistrations.length === 0) {
      logger.info(`All pending registrations have been processed already`);
      return;
    }

    if (memoryFilteredRegistrations.length !== pendingRegistrations.length) {
      const memoryFilteredIds = memoryFilteredRegistrations.map(r => `${r.id} (Election: ${r.electionID})`).join(', ');
      const pendingIds = pendingRegistrations.map(r => `${r.id} (Election: ${r.electionID})`).join(', ');

      logger.error(`Found registrations that were already processed on-chain.\nMemory Filtered: ${memoryFilteredIds}\nPending: ${pendingIds}`);
    }


    // Get all unique election IDs from pending registrations
    const electionIDs: number[] = [...new Set(memoryFilteredRegistrations.map(reg => reg.electionID))];

    const idList = memoryFilteredRegistrations.map((reg, index) => `ID ${index}: ${reg.id}`).join(', ');
    logger.info(`Found ${memoryFilteredRegistrations.length} pending registrations for ${electionIDs.length} elections: ${idList}`);


    for (const electionID of electionIDs) {
      let recentGraphRegistrations: RegistrationCache[] | null = null;

      try {
        logger.debug(`Fetching recent registrations from The-Graph for election ${electionID}`);

        const recentRegistrations: RecentRegistrationResponse = await fetchRecentRegistrations(electionID.toString(), 10);
        recentGraphRegistrations = recentRegistrations.votersRegistereds.map(reg => ({
          electionID: electionID,
          voterIDs: reg.voterIDs.map(voterID => BigInt(voterID)),
          blindedSignatures: reg.blindedSignatures.map(sig => sig.toLowerCase()),
          blindedElectionTokens: reg.blindedElectionTokens.map(token => token.toLowerCase()),
        }));
        logger.debug(`Fetched ${recentGraphRegistrations.length} registration transactions from The-Graph for election ${electionID}`);
      } catch (error) {
        logger.error(`Error fetching recent registrations from The-Graph: ${error}`);
        logger.warn(`Proceeding without on-chain verification for election ${electionID}`);
      }

      try {

        const pendingRegistrationsForElection = memoryFilteredRegistrations.filter(reg => reg.electionID === electionID);

        let finalFilteredRegistrations = pendingRegistrationsForElection;
        if (recentGraphRegistrations) {
          finalFilteredRegistrations = pendingRegistrationsForElection.filter(reg => !isRegistrationProcessed(
            reg.electionID,
            BigInt(reg.userID),
            reg.blindedSignature,
            reg.blindedToken,
            recentGraphRegistrations
          ));
          if (finalFilteredRegistrations.length !== pendingRegistrationsForElection.length) {
            const finalFilteredIds = finalFilteredRegistrations.map(r => `${r.id} (Election: ${r.electionID})`).join(', ');
            const pendingIds = pendingRegistrationsForElection.map(r => `${r.id} (Election: ${r.electionID})`).join(', ');
            logger.error(`Found registrations that were already processed on-chain.\nFinal Filtered: ${finalFilteredIds}\nPending: ${pendingIds}`);
          }
        }

        logger.debug(`Filtered ${pendingRegistrationsForElection.length} -> ${finalFilteredRegistrations.length} registrations for election ${electionID}`);

        logger.info(`Processing ${finalFilteredRegistrations.length} registrations for election ${electionID}`);
        if (finalFilteredRegistrations.length === 0) {
          logger.error(`No new registrations found for election ${electionID}`);
          continue;
        }

        // Split registrations into batches
        const registrationBatches = splitIntoBatches(finalFilteredRegistrations, BATCH_SIZE);
        logger.info(`Split into ${registrationBatches.length} batches with max size of ${BATCH_SIZE}`);

        // Process each batch
        for (let batchIndex = 0; batchIndex < registrationBatches.length; batchIndex++) {
          const registrationBatch = registrationBatches[batchIndex];
          logger.info(`Processing batch ${batchIndex + 1}/${registrationBatches.length} with ${registrationBatch.length} registrations`);

          const voterIDs: bigint[] = [];
          const blindedSignatures: string[] = [];
          const blindedElectionTokens: string[] = [];

          registrationBatch.forEach(registration => {
            voterIDs.push(BigInt(registration.userID));
            blindedSignatures.push(registration.blindedSignature.toLowerCase());
            blindedElectionTokens.push(registration.blindedToken.toLowerCase());
          });

          logger.info(`Preparing to register ${voterIDs.length} voters for election ID: ${electionID} (batch ${batchIndex + 1}/${registrationBatches.length})`);
          const feeData = await provider.getFeeData();
          const maxFeePerGas = feeData.maxFeePerGas;
          const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;

          if (!maxFeePerGas || !maxPriorityFeePerGas) {
            throw new Error('Max fee per gas or max priority fee per gas not found. Node down?');
          }

          const MIN_PRIORITY_FEE = ethers.parseUnits('1', 'gwei');
          const adjustedMaxPriorityFeePerGas = maxPriorityFeePerGas < MIN_PRIORITY_FEE
            ? MIN_PRIORITY_FEE
            : (maxPriorityFeePerGas * TX_MULTIPLIERS.MAX_PRIORITY_FEE_PERCENTAGE) / 100n;

          const adjustedMaxFeePerGas = (maxFeePerGas * TX_MULTIPLIERS.MAX_FEE_PERCENTAGE) / 100n;

          logger.info("Transaction Gas Fees", {
            maxFeePerGas: ethers.formatUnits(maxFeePerGas, "gwei"),
            maxPriorityFeePerGas: ethers.formatUnits(maxPriorityFeePerGas, "gwei"),
            adjustedMaxFeePerGas: ethers.formatUnits(adjustedMaxFeePerGas, "gwei"),
            adjustedMaxPriorityFeePerGas: ethers.formatUnits(adjustedMaxPriorityFeePerGas, "gwei"),
          });

          if (adjustedMaxFeePerGas > ethers.parseUnits(MAX_FEE_PER_GAS_IN_GWEI!, "gwei") || adjustedMaxPriorityFeePerGas > ethers.parseUnits(MAX_PRIORITY_FEE_PER_GAS_IN_GWEI!, "gwei")) {
            logger.error(`Max fee per gas or max priority fee per gas is too high. MAX_FEE_PER_GAS: ${MAX_FEE_PER_GAS_IN_GWEI} | MAX_PRIORITY_FEE_PER_GAS: ${MAX_PRIORITY_FEE_PER_GAS_IN_GWEI}`);
            throw new Error('Max fee per gas or max priority fee per gas is too high');
          }

          const estimatedGas = await contract.registerVoters.estimateGas(
            BigInt(electionID),
            voterIDs,
            blindedSignatures,
            blindedElectionTokens,
            { maxFeePerGas: adjustedMaxFeePerGas, maxPriorityFeePerGas: adjustedMaxPriorityFeePerGas }
          );
          const gasLimitWithBuffer = (estimatedGas * TX_MULTIPLIERS.GAS_LIMIT_PERCENTAGE) / 100n

          logger.info("Gas estimation", {
            estimatedGas: estimatedGas.toString(),
            gasLimitWithBuffer: gasLimitWithBuffer.toString(),
          });

          // Create and send transaction
          const tx: ethers.TransactionResponse = await contract.registerVoters(
            BigInt(electionID),
            voterIDs,
            blindedSignatures,
            blindedElectionTokens,
            {
              maxFeePerGas: adjustedMaxFeePerGas,
              maxPriorityFeePerGas: adjustedMaxPriorityFeePerGas,
              gasLimit: gasLimitWithBuffer
            }
          );
          logger.info(`Transaction sent: ${tx.hash}`);

          // Generate a batch ID for this group of registrations
          const batchID = `batch-${Date.now()}-${electionID}-${batchIndex}`;

          registrationCacheMemory.push({
            electionID,
            voterIDs,
            blindedSignatures,
            blindedElectionTokens,
            batchID
          });

          // Update all registrations to 'submitted' status
          for (const registration of registrationBatch) {
            await BlindedSignatureService.updateRegistrationStatus(
              registration.id,
              'submitted',
              tx.hash,
              batchID
            );
            logger.debug(`Updated registration ID ${registration.id} to submitted status`);
          }

          try {

            const receipt = await waitForTransaction(tx, TX_LIMITS.DEFAULT_TX_TIMEOUT);
            if (!receipt || receipt.status !== 1) {
              logger.error(`Transaction failed: ${tx.hash} batchID: ${batchID}`);
              throw new Error(`Transaction failed: ${tx.hash}`);
            }
            logger.info(`Transaction successfully confirmed`, { electionID, txHash: tx.hash, batchID, voterCount: voterIDs.length });
            for (const registration of registrationBatch) {
              await BlindedSignatureService.updateRegistrationStatus(
                registration.id,
                'confirmed',
                tx.hash,
                batchID
              );
              logger.debug(`Updated registration ID ${registration.id} to confirmed status`);
            }

          } catch (error) {
            logger.error("Transaction failed or timeout reached:", error);
            for (const registration of registrationBatch) {
              await BlindedSignatureService.updateRegistrationStatus(
                registration.id,
                'failed',
                tx.hash,
                batchID
              );
              logger.debug(`Updated registration ID ${registration.id} to failed status`);
            }
          }
          finally {
            await timeout(30000); // 30 seconds timeout to not hit any rate limits

          }
        }
      } catch (error) {
        logger.error(`Error processing pending Registrations with electionID: ${electionID}`, error);
        await timeout(30000); // 30 seconds timeout for potential node recovery

      }
    }
  } catch (error) {
    logger.error(`Error processing pending Registrations: ${error}`);
  } finally {
    isProcessing = false;
    await timeout(30000); // 30 seconds timeout to not hit any rate limits
  }
}


/**
 * Waits for a given amount of time
 * @param ms - The amount of time to wait
 */
async function timeout(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Waits for a transaction to be confirmed
 * @param tx - The transaction to wait for
 * @param timeoutMs - The timeout for the transaction
 * @returns The transaction receipt or null if the transaction failed
 */
async function waitForTransaction(tx: ethers.TransactionResponse, timeoutMs = TX_LIMITS.DEFAULT_TX_TIMEOUT): Promise<ethers.TransactionReceipt | null> {
  return Promise.race([
    tx.wait(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Transaction timeout exceeded")), timeoutMs))
  ]);
}

/**
 * Validates the balance of the wallet
 * @param balance - The balance of the wallet
 * @returns true if the balance is sufficient, false otherwise
 */
function validateBalance(balance: bigint): boolean {
  if (balance < WALLET_THRESHOLDS.MINIMUM_BALANCE) {
    logger.error(`Insufficient balance: ${ethers.formatEther(balance)} Wallet: ${wallet.address}`);
    return false;
  } else if (balance < WALLET_THRESHOLDS.LOW_BALANCE) {
    logger.warn(`Register Wallet Balance is low: ${ethers.formatEther(balance)} Wallet: ${wallet.address}`);
    return true;
  } else {
    logger.info(`Register Wallet Balance: ${ethers.formatEther(balance)} Wallet: ${wallet.address}`);
    return true;
  }
}

/**
 * Splits an array into batches of specified size
 * @param items - The array to split
 * @param batchSize - The size of each batch
 * @returns An array of batches
 */
function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}