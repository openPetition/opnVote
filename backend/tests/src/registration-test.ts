import axios from 'axios';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { blindToken, deriveElectionR, deriveElectionUnblindedToken, generateMasterTokenAndMasterR } from "votingsystem";
import { Register } from "./config";

const timestampSec = Math.floor(Date.now() / 1000);
const modifiedTimestamp = timestampSec % 1000000000;
const baseUserId = modifiedTimestamp + 10000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface TestStats {
  successfulApi: number;
  failedApi: number;
  successfulOnChain: number;
  failedOnChain: number;
  startTime: Date;
  endTime: Date;
  pendingUserIDs: Set<number>;
}

interface TestConfig {
  count: number;
  url: string;
  subgraphUrl: string;
  concurrency: number;
  apPrivateKeyPath: string;
  electionID: number;
  baseUserId: number;
  onChainCheckIntervalMs: number;
  onChainCheckTimeoutMs: number;
  batchDelayMs?: number; // Optional delay between batches
}

const config: TestConfig = {
  count: 10,
  url: 'https://register.opn.vote/api/sign',
  subgraphUrl: 'https://graphql.opn.vote/subgraphs/name/opnvote-002/',
  concurrency: 2,
  apPrivateKeyPath: './keys/AP-privateKey.pem',
  electionID: 1,
  baseUserId: baseUserId,
  onChainCheckIntervalMs: 30 * 1000, // 30 seconds
  onChainCheckTimeoutMs: 8 * 60 * 1000, // 8 minutes
  batchDelayMs: 10 * 1000 // 20 seconds delay
};

async function createRegistrationPayload() {
  const { masterToken, masterR } = generateMasterTokenAndMasterR();
  const electionID = config.electionID;
  const unblindedElectionToken = deriveElectionUnblindedToken(electionID, masterToken);
  const electionR = deriveElectionR(electionID, masterR, unblindedElectionToken, Register);
  const blindedElectionToken = blindToken(unblindedElectionToken, electionR, Register);

  return {
    token: blindedElectionToken,
    electionID
  };
}

async function createAuthToken(electionID: number, userID: number): Promise<string> {
  try {
    let apPrivateKey: string;
    if (process.env.AP_PRIVATE_KEY) {
      apPrivateKey = process.env.AP_PRIVATE_KEY.replace(/\\n/g, '\n');
    } else if (fs.existsSync(config.apPrivateKeyPath)) {
      apPrivateKey = fs.readFileSync(config.apPrivateKeyPath, 'utf8');
    } else {
      throw new Error("No private key available - set PRIVATE_KEY environment variable or provide a key file");
    }

    const payload = {
      userID: userID,
      electionID: electionID
    };

    return jwt.sign(payload, apPrivateKey, { algorithm: 'RS256' });
  } catch (error) {
    console.error('Error creating auth token:', error);
    throw error;
  }
}

async function makeRegistrationRequest(userID: number): Promise<number | null> {
  try {
    const { token } = await createRegistrationPayload();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    const jwtToken = await createAuthToken(config.electionID, userID);
    headers['Authorization'] = `Bearer ${jwtToken}`;

    const response = await axios.post(
      config.url,
      { token },
      {
        headers,
      }
    ) as any;

    const resData = response.data;

    if (!resData?.data?.blindedSignature) {
      console.error(`UserID ${userID}: Invalid response structure or missing blindedSignature. Response:`, JSON.stringify(resData));
      return null;
    }

    const topLevelKeyCount = resData ? Object.keys(resData).length : 0;
    const dataLevelKeyCount = resData.data ? Object.keys(resData.data).length : 0;

    if (dataLevelKeyCount >= 1 && resData.data.blindedSignature) {
      if (topLevelKeyCount > 2 || dataLevelKeyCount > 1) {
        console.warn(`UserID ${userID}: Received blindedSignature, but response contained unexpected data. Response:`, JSON.stringify(resData));
      }
      return userID;
    } else {
      console.error(`UserID ${userID}: BlindedSignature missing or invalid structure. Response:`, JSON.stringify(resData));
      return null;
    }
  } catch (error) {
    console.error(`Registration request failed for UserID ${userID}: ${error}`);
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const axiosError = error as any;
      if (axiosError.response) {
        console.error(`Status: ${axiosError.response.status}, Response: ${JSON.stringify(axiosError.response.data)}`);
      }
    } else if (error instanceof Error) {
      console.error('Standard Error:', error.message);
    }
    return null;
  }
}

async function fetchOnChainVoterIDs(electionID: number): Promise<number[]> {
  const query = `
    query CheckRecentVoterIDs($electionID: String!) {
      votersRegistereds(
        where: { electionID: $electionID }
        orderBy: blockTimestamp
        orderDirection: desc
        first: 1000 # Fetch a reasonable large number, adjust if needed
      ) {
        voterIDs
      }
    }
  `;

  try {
    const response = await axios.post(config.subgraphUrl, {
      query,
      variables: { electionID: electionID.toString() },
    }, {
      headers: { 'Content-Type': 'application/json' }
    }) as any;

    const votersRegisteredEvents = response.data?.data?.votersRegistereds;

    if (!votersRegisteredEvents || !Array.isArray(votersRegisteredEvents)) {
      console.error('Invalid response structure from subgraph:', JSON.stringify(response.data));
      return [];
    }

    const voterIDs: number[] = votersRegisteredEvents
      .flatMap((event: { voterIDs?: string[] }) => event.voterIDs || [])
      .map((id: string) => parseInt(id, 10))
      .filter((id: number) => !isNaN(id));

    return voterIDs;

  } catch (error) {
    console.error('Error fetching data from subgraph:', error);
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const axiosError = error as any;
      if (axiosError.response) {
        console.error(`Subgraph query failed - Status: ${axiosError.response.status}, Response: ${JSON.stringify(axiosError.response.data)}`);
      }
    }
    return [];
  }
}

async function verifyOnChainRegistrations(stats: TestStats): Promise<void> {
  const verificationStartTime = Date.now();
  const verificationEndTime = verificationStartTime + config.onChainCheckTimeoutMs;
  const initialPendingCount = stats.pendingUserIDs.size;

  console.log(`Starting on-chain verification for ${initialPendingCount} UserIDs. Timeout: ${config.onChainCheckTimeoutMs / 1000}s`);

  while (Date.now() < verificationEndTime && stats.pendingUserIDs.size > 0) {
    try {
      const onChainIDs = await fetchOnChainVoterIDs(config.electionID);
      const foundIDsThisCheck: number[] = [];

      const pendingIDsToCheck = Array.from(stats.pendingUserIDs);

      for (const pendingID of pendingIDsToCheck) {
        if (onChainIDs.includes(pendingID)) {
          stats.pendingUserIDs.delete(pendingID);
          stats.successfulOnChain++;
          foundIDsThisCheck.push(pendingID);
        }
      }

      if (foundIDsThisCheck.length > 0) {
        console.log(`[On-Chain Check] Verified ${foundIDsThisCheck.length} more UserIDs. Remaining: ${stats.pendingUserIDs.size}. Verified IDs: ${foundIDsThisCheck.join(', ')}`);
      } else {
        console.log(`[On-Chain Check] No new UserIDs verified. Remaining: ${stats.pendingUserIDs.size}.`);
      }


      if (stats.pendingUserIDs.size === 0) {
        console.log("All pending UserIDs successfully verified on-chain.");
        break;
      }

    } catch (error) {
      console.error("Error during on-chain verification cycle:", error);
    }

    if (Date.now() < verificationEndTime && stats.pendingUserIDs.size > 0) {
      console.log(`Waiting ${config.onChainCheckIntervalMs / 1000}s for the next check...`);
      await sleep(config.onChainCheckIntervalMs);
    }
  }

  if (stats.pendingUserIDs.size > 0) {
    console.warn(`On-chain verification timed out after ${config.onChainCheckTimeoutMs / 1000}s.`);
    stats.failedOnChain = stats.pendingUserIDs.size;
    const remainingIDs = Array.from(stats.pendingUserIDs).join(', ');
    console.log(`Failed to verify ${stats.failedOnChain} UserIDs on-chain within the timeout: ${remainingIDs}`);
  } else if (Date.now() >= verificationEndTime) {
    console.log("On-chain verification finished at the timeout limit.");
    stats.failedOnChain = stats.pendingUserIDs.size;
  } else {
    console.log("On-chain verification completed successfully before timeout.");
    stats.failedOnChain = 0;
  }


  const duration = (Date.now() - verificationStartTime) / 1000;
  console.log(`On-chain verification phase finished in ${duration.toFixed(2)}s. Verified: ${stats.successfulOnChain}, Timed Out/Failed: ${stats.failedOnChain}`);
}

async function runLoadTest(): Promise<void> {
  const stats: TestStats = {
    successfulApi: 0,
    failedApi: 0,
    successfulOnChain: 0,
    failedOnChain: 0,
    startTime: new Date(),
    endTime: new Date(),
    pendingUserIDs: new Set<number>(),
  };

  console.log(`Starting registration load test with ${config.count} requests to ${config.url}`);
  console.log(`Using concurrency of ${config.concurrency} requests`);
  console.log(`Using ElectionID: ${config.electionID}`);
  console.log(`Starting UserID: ${config.baseUserId}`);
  console.log(`Subgraph URL for verification: ${config.subgraphUrl}`);
  console.log(`On-chain check interval: ${config.onChainCheckIntervalMs / 1000}s, Timeout: ${config.onChainCheckTimeoutMs / 1000 / 60}min`);

  const batchSize = config.concurrency;
  const batches = Math.ceil(config.count / batchSize);
  let currentUserID = config.baseUserId;

  for (let i = 0; i < batches; i++) {
    const currentBatchSize = Math.min(batchSize, config.count - (i * batchSize));
    const promises = [];

    console.log(`Starting batch ${i + 1}/${batches} (Size: ${currentBatchSize})`);
    const batchUserIDs: number[] = [];

    for (let j = 0; j < currentBatchSize; j++) {
      const userIdForRequest = currentUserID++;
      batchUserIDs.push(userIdForRequest);
      promises.push(makeRegistrationRequest(userIdForRequest));
    }

    const results = await Promise.all(promises);

    results.forEach((resultUserID, index) => {
      const originalUserID = batchUserIDs[index];
      if (resultUserID !== null && resultUserID === originalUserID) {
        stats.successfulApi++;
        stats.pendingUserIDs.add(resultUserID);
      } else {
        stats.failedApi++;
        if (resultUserID !== null && resultUserID !== originalUserID) {
          console.error(`Mismatch: Request for UserID ${originalUserID} returned ${resultUserID}`);
        }
      }
    });

    console.log(`Completed batch ${i + 1}/${batches} - API Success: ${stats.successfulApi}, API Failed: ${stats.failedApi}, Pending On-Chain: ${stats.pendingUserIDs.size}`);

    if (config.batchDelayMs && config.batchDelayMs > 0 && i < batches - 1) {
      console.log(`Waiting for ${config.batchDelayMs / 1000}s before next batch...`);
      await sleep(config.batchDelayMs);
    }

  }

  console.log(`\nAPI Registration phase complete. Total successful API requests: ${stats.successfulApi}.`);

  if (stats.pendingUserIDs.size > 0) {
    console.log(`Starting on-chain verification for ${stats.pendingUserIDs.size} user IDs...`);
    await verifyOnChainRegistrations(stats);
  } else {
    console.log("No successful API registrations to verify on-chain.");
  }

  stats.endTime = new Date();
  printResults(stats);
}

function printResults(stats: TestStats): void {
  const duration = (stats.endTime.getTime() - stats.startTime.getTime()) / 1000;
  const totalApiRequests = stats.successfulApi + stats.failedApi;

  console.log('\n=== Registration Load Test Results ===');
  console.log(`Total Duration: ${duration.toFixed(2)} seconds`);
  console.log(`--- API Registration ---`);
  console.log(`Total API Requests attempted: ${totalApiRequests}`);
  console.log(`Successful API Requests: ${stats.successfulApi}`);
  console.log(`Failed API Requests: ${stats.failedApi}`);
  if (totalApiRequests > 0) {
    console.log(`API Success Rate: ${((stats.successfulApi / totalApiRequests) * 100).toFixed(2)}%`);
  }
  if (duration > 0) {
    console.log(`API Requests per second: ${(totalApiRequests / duration).toFixed(2)}`);
  }

  console.log(`--- On-Chain Verification ---`);
  console.log(`Attempted to Verify (Successful API): ${stats.successfulApi}`);
  console.log(`Successfully Verified On-Chain: ${stats.successfulOnChain}`);
  console.log(`Failed Verification (Timeout): ${stats.failedOnChain}`);
  if (stats.successfulApi > 0) {
    const onChainSuccessRate = ((stats.successfulOnChain / stats.successfulApi) * 100).toFixed(2);
    console.log(`On-Chain Verification Success Rate: ${onChainSuccessRate}%`);
  }
  if (stats.pendingUserIDs.size > 0) {
    console.warn(`Warning: ${stats.pendingUserIDs.size} UserIDs might still be pending verification if test ended prematurely.`);
  }

  if (stats.successfulApi < config.count) {
    console.error(`Test FAILED: Only ${stats.successfulApi}/${config.count} API registrations succeeded`);
    process.exit(1);
  }
  
  if (stats.successfulOnChain < stats.successfulApi) {
    console.error(`Test FAILED: Only ${stats.successfulOnChain}/${stats.successfulApi} registrations verified on-chain`);
    process.exit(1);
  }
  
  console.log("Test PASSED: All registrations succeeded and were verified on-chain");
}

async function main() {
  await runLoadTest();
}

main().catch(console.error);

