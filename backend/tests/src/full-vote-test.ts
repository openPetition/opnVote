import axios from 'axios';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { addSVSSignatureToVotingTransaction, blindToken, createRelayRequest, createSignatureData, createVotingTransactionWithoutSVSSignature, deriveElectionR, deriveElectionUnblindedToken, ElectionCredentials, EncryptionKey, EncryptionType, encryptVotes, EthSignature, generateKeyPair, generateMasterTokenAndMasterR, PublicKeyDer, R, RSAParams, Signature, TestRegister, Token, unblindSignature, Vote, VoteOption, VotingTransaction, createVoterCredentials } from "votingsystem";
import { Register } from "./config";
import { ethers } from 'ethers';
import opnvoteAbi from './abi/opnvote-0.0.3.json';
import dotenv from 'dotenv';
dotenv.config();

const RPC_PROVIDER = process.env.RPC_PROVIDER;
if (!RPC_PROVIDER) {
    throw new Error("RPC_PROVIDER environment variable not set.");
}

//Generate a unique user ID for each test run
const TEST_RUN_ID = 1;

const timestampSec = Math.floor(Date.now() / 1000);
const modifiedTimestamp = timestampSec % 1000000000;
const TEST_RUN_OFFSET = TEST_RUN_ID * 1_000_000; // guarantees 1M space between different test cases
const baseUserId = modifiedTimestamp + TEST_RUN_OFFSET;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const RegisterPublic: RSAParams = {
    e: BigInt("0x10001"),
    N: BigInt("0x00d4a8a98b01e65513c6b2d0e75fb63174994bf145104aec748f9e0a032a7b6fd07f7770ea13b82460684f4d4c9efcb39efa291f9ee5b5bb973ccffa61ff538ef4da1619ced6b88c64654e1b6f1cbccfef6de750c6eef4a0a99dd99e3fa6fa83793cf5c9d165897c621425eb276fd7415e77a59219ffae28c9cb2b6e37aef092c50e70b382c52e857da6ade1eba30a01301c57471a0c0ef6ef29d611b7e029a874617b31b355ab907c3731e5158cddb91dbde9da1f03757e4838351db1cd31c67981749e081bc584e694f15769e08ad9b62d97be3c3567b4730de607d16380f79101d35794c1eca9b3a7a573fac6299893306d3436f7da8405ea217410fa54ac01"),
    NbitLength: 2048, // Bit length of N
};

const coordinatorKeyPublic: EncryptionKey = {
    hexString: "0x30820122300d06092a864886f70d01010105000382010f003082010a0282010100ac6c8107390d61b9aa4b7110810cf883aed499338e5b8ef39eab55a9a056fdb703564718b8d544e11443edbf97f112bc502689e6f4c81b859abfe3e0490f6ad124ef9704ee9ca6956f433186dd84c1e88e5ab7f4d5370da244aa4d0486d82b99f3ca0d7a2142c3f07c4a37e5fd997b7e891bd2d562127e05d1ee5022bc1d02000356cfa2c28d5c91324858ca4b6d7025434bb55bd63c44f179bc268b3759412ba94ac9a99932908511571ae78d9c073ecd1e7d3e1b94576001bd972bfd80711692ddff574355de39e70ee1961bc3a78fa7df273d10b27cce2a68a3511b5605ddaa546503c577e4fb05124bd53109b4de8e7c5f1aaf06dacd6fdc7866c01098a30203010001",
    encryptionType: EncryptionType.RSA
}


interface TestStats {
    successfulApi: number;
    failedApi: number;
    failedOnChain: number;
    successfulSvsSign: number;
    failedSvsSign: number;
    successfulSvsForward: number;
    failedSvsForward: number;
    successfulGelatoVerify: number;
    failedGelatoVerify: number;
    successfulTxVerify: number;
    failedTxVerify: number;
    startTime: Date;
    endTime: Date;
    pendingUserIDs: Set<number>;
    successfulTransactions: { voterId: number; txHash: string }[];
}

interface TestConfig {
    count: number;
    registerUrl: string;
    svsSignUrl: string;
    svsForwardUrl: string;
    opnVoteAddress: string;
    opnVoteInterface: ethers.Interface;
    provider: ethers.JsonRpcProvider;
    subgraphUrl: string;
    concurrency: number;
    apPrivateKeyPath: string;
    electionID: number;
    baseUserId: number;
    onChainCheckIntervalMs: number;
    onChainCheckTimeoutMs: number;
    registerKeyPublic: RSAParams;
    coordinatorKeyPublic: EncryptionKey;
    batchDelayMs?: number; // Optional delay between batches
}

interface Voter {
    userID: number;
    electionR: R;
    masterToken: Token;
    unblindedElectionToken: Token | null;
    blindedElectionToken: Token | null;
    voterCredentials: ElectionCredentials | null;
    votingTransaction: VotingTransaction | null;
    voterSignature: EthSignature | null;
}

interface TaskInfo {
    taskId: string;
    voterId: number;
}

const config: TestConfig = {
    count: 10,
    registerUrl: 'https://register.opn.vote/api/sign',
    svsSignUrl: 'https://svs.opn.vote/api/votingTransaction/sign',
    svsForwardUrl: 'https://svs.opn.vote/api/gelato/forward',
    opnVoteInterface: new ethers.Interface(opnvoteAbi),
    provider: new ethers.JsonRpcProvider(RPC_PROVIDER),
    subgraphUrl: 'https://graphql.opn.vote/subgraphs/name/opnvote-003/',
    opnVoteAddress: '0xc2958f59C2F333b1ad462C7a3969Da1E0B662459',
    concurrency: 2,
    apPrivateKeyPath: './keys/AP-privateKey.pem',
    electionID: 0,
    baseUserId: baseUserId,
    onChainCheckIntervalMs: 30 * 1000, // 30 seconds
    onChainCheckTimeoutMs: 5 * 60 * 1000, // 5 minutes
    registerKeyPublic: RegisterPublic,
    coordinatorKeyPublic: coordinatorKeyPublic,
    batchDelayMs: 10 * 1000 // 10 seconds delay
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

interface RegistrationResponse {
    data: {
        blindedSignature: string;
    };
    error: null | string;
}
async function sendRegistrationRequest(voter: Voter): Promise<{ userID: number | null; blindedSignature: string | null }> {
    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        const jwtToken = await createAuthToken(config.electionID, voter.userID);
        headers['Authorization'] = `Bearer ${jwtToken}`;

        const response = await axios.post<RegistrationResponse>(
            config.registerUrl,
            { token: voter.blindedElectionToken },
            {
                headers,
            }
        );

        const resData = response.data;

        if (!resData?.data?.blindedSignature) {
            console.error(`UserID ${voter.userID}: Invalid response structure or missing blindedSignature. Response:`, JSON.stringify(resData));
            return { userID: null, blindedSignature: null };
        }

        const topLevelKeyCount = resData ? Object.keys(resData).length : 0;
        const dataLevelKeyCount = resData.data ? Object.keys(resData.data).length : 0;

        if (dataLevelKeyCount >= 1 && resData.data.blindedSignature) {
            if (topLevelKeyCount > 2 || dataLevelKeyCount > 1) {
                console.warn(`UserID ${voter.userID}: Received blindedSignature, but response contained unexpected data. Response:`, JSON.stringify(resData));
            }
            return { userID: voter.userID, blindedSignature: resData.data.blindedSignature };
        } else {
            console.error(`UserID ${voter.userID}: BlindedSignature missing or invalid structure. Response:`, JSON.stringify(resData));
            return { userID: null, blindedSignature: null };
        }
    } catch (error) {
        console.error(`Registration request failed for UserID ${voter.userID}: ${error}`);
        if (typeof error === 'object' && error !== null && 'response' in error) {
            const axiosError = error as any;
            if (axiosError.response) {
                console.error(`Status: ${axiosError.response.status}, Response: ${JSON.stringify(axiosError.response.data)}`);
            }
        } else if (error instanceof Error) {
            console.error('Standard Error:', error.message);
        }
        return { userID: null, blindedSignature: null };
    }
}

async function sendSvsSignRequest(votingTransaction: VotingTransaction, voterSignature: EthSignature): Promise<EthSignature | null> {
    try {
        const response = await axios.post<any>(
            config.svsSignUrl,
            {
                votingTransaction,
                voterSignature
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data?.data?.blindedSignature;
    } catch (error) {
        console.error('SVS Sign request failed:', error);
        return null;
    }
}


async function sendSvsForwardRequest(signatureData: any): Promise<string | null> {
    try {
        const response = await axios.post<any>(
            config.svsForwardUrl,
            signatureData,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        if (response.data?.data?.taskId) {
            return response.data.data.taskId
        } else {
            return null;
        }
    } catch (error) {
        console.error('SVS Forward request failed:', error);
        return null;
    }
}

interface GelatoTaskStatus {
    task: {
        chainId: number;
        taskId: string;
        taskState: string;
        creationDate: string;
        transactionHash: string;
        executionDate: string;
        blockNumber: number;
        gasUsed: string;
        effectiveGasPrice: string;
    }
}

async function checkGelatoTaskStatus(taskId: string): Promise<GelatoTaskStatus | null> {
    try {
        const response = await axios.get<GelatoTaskStatus>(`https://api.gelato.digital/tasks/status/${taskId}`);
        return response.data;
    } catch (error) {
        console.error(`Error checking Gelato task status for taskId ${taskId}:`, error);
        return null;
    }
}

async function verifyTransactionOnChain(transactionHash: string, maxAttempts: number = 5, delayMs: number = 5000): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const receipt = await config.provider.getTransactionReceipt(transactionHash);
            if (receipt && receipt.status === 1) {
                return true;
            } else if (receipt && receipt.status === 0) {
                console.error(`Transaction ${transactionHash} reverted (attempt ${attempt + 1}/${maxAttempts}).`);
                return false;
            }
            console.log(`Transaction ${transactionHash} not yet confirmed (attempt ${attempt + 1}/${maxAttempts}). Receipt: ${JSON.stringify(receipt)}`);
        } catch (error) {
            console.error(`Error fetching receipt for ${transactionHash} (attempt ${attempt + 1}/${maxAttempts}):`, error);
        }
        if (attempt < maxAttempts - 1) {
            await sleep(delayMs);
        }
    }
    console.error(`Transaction verification failed for hash ${transactionHash} after ${maxAttempts} attempts.`);
    return false;
}

async function waitForGelatoTask(taskId: string, options: { timeoutMs: number; intervalMs: number }): Promise<GelatoTaskStatus | null> {
    const maxAttempts = Math.ceil(options.timeoutMs / options.intervalMs);
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const status = await checkGelatoTaskStatus(taskId);
        if (!status) {
            return null;
        }

        const taskState = status.task.taskState;
        if (taskState === "ExecSuccess") {
            return status;
        } else if (taskState === "ExecReverted" || taskState === "Cancelled") {
            console.error(`Task ${taskId} failed with state: ${taskState}`);
            return null;
        }

        // Task is still pending
        console.log(`Task ${taskId} is still pending (${taskState}). Attempt ${attempt + 1}/${maxAttempts}`);
        await sleep(options.intervalMs);
    }

    console.error(`Task ${taskId} timed out after ${maxAttempts} attempts`);
    return null;
}

async function verifyGelatoTasks(taskInfos: TaskInfo[], stats: TestStats): Promise<void> {
    console.log("\nStarting Gelato task verification phase...");
    console.log(`Verifying ${taskInfos.length} tasks`);

    for (const taskInfo of taskInfos) {
        try {
            const gelatoStatus = await waitForGelatoTask(taskInfo.taskId, { timeoutMs: config.onChainCheckTimeoutMs, intervalMs: config.onChainCheckIntervalMs });
            if (gelatoStatus?.task?.taskState === "ExecSuccess") {
                stats.successfulGelatoVerify++;

                // Verify transaction on chain
                const txSuccess = await verifyTransactionOnChain(gelatoStatus.task.transactionHash);
                if (txSuccess) {
                    stats.successfulTxVerify++;
                    stats.successfulTransactions.push({
                        voterId: taskInfo.voterId,
                        txHash: gelatoStatus.task.transactionHash
                    });
                } else {
                    stats.failedTxVerify++;
                    console.error(`Transaction verification failed for voter ${taskInfo.voterId}, txHash: ${gelatoStatus.task.transactionHash}`);
                }
            } else {
                stats.failedGelatoVerify++;
                console.error(`Gelato task verification failed for voter ${taskInfo.voterId}, taskId: ${taskInfo.taskId}`);
            }
        } catch (error) {
            console.error(`Error verifying task for voter ${taskInfo.voterId}:`, error);
            stats.failedGelatoVerify++;
        }
    }
}

async function runLoadTest(): Promise<void> {
    let voters: Voter[] = [];
    let taskInfos: TaskInfo[] = [];

    const stats: TestStats = {
        successfulApi: 0,
        failedApi: 0,
        failedOnChain: 0,
        successfulSvsSign: 0,
        failedSvsSign: 0,
        successfulSvsForward: 0,
        failedSvsForward: 0,
        successfulGelatoVerify: 0,
        failedGelatoVerify: 0,
        successfulTxVerify: 0,
        failedTxVerify: 0,
        startTime: new Date(),
        endTime: new Date(),
        pendingUserIDs: new Set<number>(),
        successfulTransactions: []
    };

    console.log(`Starting full vote test with ${config.count} requests`);
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
            const { masterToken, masterR } = generateMasterTokenAndMasterR();
            const unblindedElectionToken: Token = deriveElectionUnblindedToken(config.electionID, masterToken);
            const electionR: R = deriveElectionR(config.electionID, masterR, unblindedElectionToken, config.registerKeyPublic);
            const blindedElectionToken: Token = blindToken(unblindedElectionToken, electionR, config.registerKeyPublic)

            const voter: Voter = {
                userID: userIdForRequest,
                masterToken: masterToken,
                electionR: electionR,
                unblindedElectionToken: unblindedElectionToken,
                blindedElectionToken: blindedElectionToken,
                voterCredentials: null,
                votingTransaction: null,
                voterSignature: null
            }
            voters.push(voter);

            batchUserIDs.push(userIdForRequest);
            promises.push(sendRegistrationRequest(voter));
        }

        const results = await Promise.all(promises);
        results.forEach((result, index) => {
            const originalUserID = batchUserIDs[index];
            if (result.userID !== null && result.userID === originalUserID && result.blindedSignature !== null) {
                stats.successfulApi++;
                stats.pendingUserIDs.add(result.userID);
                for (const voter of voters) {
                    if (voter.userID === originalUserID) {
                        const blindedSignature = { hexString: result.blindedSignature, isBlinded: true }
                        const unblindedSignature = unblindSignature(blindedSignature, voter.electionR, config.registerKeyPublic)
                        voter.voterCredentials = createVoterCredentials(unblindedSignature, voter.unblindedElectionToken!, voter.masterToken, config.electionID);
                        voter.unblindedElectionToken = null;
                        voter.blindedElectionToken = null;
                        break;
                    }
                }

            } else {
                stats.failedApi++;
                if (result.userID !== null && result.userID !== originalUserID) {
                    console.error(`Mismatch: Request for UserID ${originalUserID} returned ${result.userID}`);
                }
                if (result.blindedSignature === null) {
                    console.error(`Failed to get blinded signature for UserID ${originalUserID}`);
                }
            }
        });

        console.log(`Completed batch ${i + 1}/${batches} - API Success: ${stats.successfulApi}, API Failed: ${stats.failedApi}, Pending On-Chain: ${stats.pendingUserIDs.size}`);

        if (config.batchDelayMs && config.batchDelayMs > 0 && i < batches - 1) {
            console.log(`Waiting for ${config.batchDelayMs / 1000}s before next batch...`);
            await sleep(config.batchDelayMs);
        }
    }

    console.log("Skipping on-chain verification for full vote test")
    console.log(`API Registration phase complete. Total successful API requests: ${stats.successfulApi}/${config.count}`)


    // SVS Signing Phase
    console.log("\nStarting SVS Signing and Forwarding phase...");


    for (const voter of voters) {
        try {

            if (voter.voterCredentials === null) {
                console.log(`Voter ${voter.userID} has no voter credentials. Registration failed. Skipping SVS Signing phase.`);
                continue;
            }

            // Create votes
            const votes: Vote[] = [
                { value: VoteOption.Yes },
                { value: VoteOption.No },
                { value: VoteOption.No }
            ];
            const encryptedVotesAES = await encryptVotes(votes, voter.voterCredentials.encryptionKey, EncryptionType.AES)
            const encryptedVotesRSA = await encryptVotes(votes, config.coordinatorKeyPublic, EncryptionType.RSA)
            voter.votingTransaction = createVotingTransactionWithoutSVSSignature(voter.voterCredentials, encryptedVotesRSA, encryptedVotesAES);

            // voter signing
            const voterWallet = new ethers.Wallet(voter.voterCredentials.voterWallet.privateKey);
            const messageHash = ethers.hashMessage(JSON.stringify(voter.votingTransaction));

            voter.voterSignature = {
                hexString: await voterWallet.signMessage(messageHash)
            };

            // SVS sign request
            const svsSignature: EthSignature | null = await sendSvsSignRequest(voter.votingTransaction, voter.voterSignature);
            if (svsSignature) {
                stats.successfulSvsSign++;
            } else {
                stats.failedSvsSign++;
                console.error(`SVS Signing failed for voter ${voter.userID}`);
                continue;
            }

            //Retrieve SVS Signature
            const openVoteAbi = new ethers.Interface(opnvoteAbi)
            const votingTransactionFull: VotingTransaction = addSVSSignatureToVotingTransaction(voter.votingTransaction, svsSignature)
            const relayRequest = await createRelayRequest(votingTransactionFull, voter.voterCredentials, config.opnVoteAddress, openVoteAbi, config.provider)
            const signatureData = await createSignatureData(relayRequest, voter.voterCredentials, null, config.provider)

            const singautrDataSerialized = JSON.stringify(signatureData, bigIntReplacer)
            const parsedData = JSON.parse(singautrDataSerialized);

            const taskID = await sendSvsForwardRequest(parsedData);
            if (taskID) {
                stats.successfulSvsForward++;
                taskInfos.push({ taskId: taskID, voterId: voter.userID });
            } else {
                stats.failedSvsForward++;
            }

        } catch (error) {
            console.error(`Error processing SVS steps for voter ${voter.userID}`, error);
            stats.failedSvsSign++;
            stats.failedSvsForward++;
        }
    }

    await verifyGelatoTasks(taskInfos, stats);

    stats.endTime = new Date();
    printResults(stats);
}

function printResults(stats: TestStats): void {
    const duration = (stats.endTime.getTime() - stats.startTime.getTime()) / 1000;
    const totalApiRequests = stats.successfulApi + stats.failedApi;

    // Print successful transaction hashes if all checks passed
    if (stats.successfulApi === config.count &&
        stats.successfulSvsSign === stats.successfulApi &&
        stats.successfulSvsForward === stats.successfulSvsSign &&
        stats.successfulGelatoVerify === stats.successfulSvsForward &&
        stats.successfulTxVerify === stats.successfulGelatoVerify) {

        console.log('\n=== Successful Transaction Hashes ===');
        console.log('VoterID | Transaction Hash');
        console.log('--------|----------------');
        stats.successfulTransactions.forEach(tx => {
            console.log(`${tx.voterId.toString().padStart(7)} | ${tx.txHash}`);
        });
        console.log('-----------------------------------\n');
    }

    console.log('\n=== Full Vote Test Results ===');
    console.log(`Total Duration: ${duration.toFixed(2)} seconds`);

    console.log(`--- Registration Phase ---`);
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


    console.log(`--- SVS Signing Phase ---`);
    console.log(`Attempted SVS Signing: ${stats.successfulSvsSign + stats.failedSvsSign}`);
    console.log(`Successful SVS Signing: ${stats.successfulSvsSign}`);
    console.log(`Failed SVS Signing: ${stats.failedSvsSign}`);
    if (stats.successfulSvsSign + stats.failedSvsSign > 0) {
        const svsSignSuccessRate = ((stats.successfulSvsSign / (stats.successfulSvsSign + stats.failedSvsSign)) * 100).toFixed(2);
        console.log(`SVS Signing Success Rate: ${svsSignSuccessRate}%`);
    }

    console.log(`--- Gelato Verification Phase ---`);
    console.log(`Attempted Gelato Verifications: ${stats.successfulGelatoVerify + stats.failedGelatoVerify}`);
    console.log(`Successful Gelato Verifications: ${stats.successfulGelatoVerify}`);
    console.log(`Failed Gelato Verifications: ${stats.failedGelatoVerify}`);
    if (stats.successfulGelatoVerify + stats.failedGelatoVerify > 0) {
        const gelatoSuccessRate = ((stats.successfulGelatoVerify / (stats.successfulGelatoVerify + stats.failedGelatoVerify)) * 100).toFixed(2);
        console.log(`Gelato Verification Success Rate: ${gelatoSuccessRate}%`);
    }

    console.log(`--- Transaction Verification Phase ---`);
    console.log(`Attempted Transaction Verifications: ${stats.successfulTxVerify + stats.failedTxVerify}`);
    console.log(`Successful Transaction Verifications: ${stats.successfulTxVerify}`);
    console.log(`Failed Transaction Verifications: ${stats.failedTxVerify}`);
    if (stats.successfulTxVerify + stats.failedTxVerify > 0) {
        const txSuccessRate = ((stats.successfulTxVerify / (stats.successfulTxVerify + stats.failedTxVerify)) * 100).toFixed(2);
        console.log(`Transaction Verification Success Rate: ${txSuccessRate}%`);
    }

    if (stats.successfulApi < config.count) {
        console.error(`Test FAILED: Only ${stats.successfulApi}/${config.count} API registrations succeeded`);
        process.exit(1);
    }

    if (stats.successfulSvsForward < stats.successfulSvsSign) {
        console.error(`Test FAILED: Only ${stats.successfulSvsForward}/${stats.successfulSvsSign} SVS forwardings succeeded`);
        process.exit(1);
    }

    if (stats.successfulGelatoVerify < stats.successfulSvsForward) {
        console.error(`Test FAILED: Only ${stats.successfulGelatoVerify}/${stats.successfulSvsForward} Gelato verifications succeeded`);
        process.exit(1);
    }

    if (stats.successfulTxVerify < stats.successfulGelatoVerify) {
        console.error(`Test FAILED: Only ${stats.successfulTxVerify}/${stats.successfulGelatoVerify} transaction verifications succeeded`);
        process.exit(1);
    }

    console.log("Test PASSED: All steps completed successfully");
}

async function main() {
    await runLoadTest();
}

main().catch(console.error);

function bigIntReplacer(key: any, value: any) {
    if (typeof value === 'bigint') {
        return Number(value);
    }
    return value;
}
