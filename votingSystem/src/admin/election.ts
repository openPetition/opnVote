import { ethers } from "ethers";
import type { Address, Hex } from "viem";
import { evmG2ToNoble, validateBlsParams, validateElectionID, validateEthAddress, validateHexString, validateRegisterID } from "../utils/utils";
import { rpcProvider, withTimeout } from "../client/utils";
import { ErrorCode, RETRY_AFTER_MS } from "./errors";
import { OPNVOTE_ABI } from "../client/abi";
import type {
    Configuration,
    CreateElectionParams,
    ElectionOnChain,
    ElectionStatus,
    ElectionStatusChangeParams,
    PreparedTransaction,
    Register,
    Result,
    SetRegisterPublicKeyOnChainParams,
} from "./types";

const ELECTION_STATUS: ElectionStatus[] = ["Pending", "Active", "Ended", "ResultsPublished", "Canceled"];

/**
 * Creates and simulates an on-chain election transaction (create, update, status change)
 *
 * @param config - Admin client config
 * @param from - sender of the transaction (election coordinator, register owner or ap owner)
 * @param funcName - function name in opnvote contract
 * @param args - function arguments
 * @returns unsigned transaction to be sent or error code
 */
async function prepareTransaction(config: Configuration, from: Address, funcName: string, args: unknown[]): Promise<Result<PreparedTransaction>> {
    const opnvote = new ethers.Contract(config.contracts.opnvote, OPNVOTE_ABI, rpcProvider(config.rpcUrl, config.chain.id));

    let calldata: string;
    try {
        validateEthAddress(from);
        calldata = opnvote.interface.encodeFunctionData(funcName, args);
    } catch (e) {
        return { ok: false, code: ErrorCode.TX_REJECTED, error: `invalid transaction params: ${String(e)}` };
    }

    try {
        await withTimeout(opnvote.getFunction(funcName).staticCall(...args, { from }));
    } catch (e) {
        if (ethers.isError(e, "CALL_EXCEPTION") && e.reason) {
            return { ok: false, code: ErrorCode.TX_REJECTED, error: `contract reverted: ${e.reason}` };
        }
        return { ok: false, code: ErrorCode.RPC_NETWORK, error: `simulation failed: ${String(e)}`, retryAfterMs: RETRY_AFTER_MS };
    }

    return { ok: true, value: { to: config.contracts.opnvote, data: calldata as Hex } };
}

/**
 * Retrieves a transaction receipt
 *
 * @param config - Admin client config
 * @param txHash - hash of the transaction
 * @returns transaction receipt or error code; TX_PENDING while tx processing
 */
async function getTransactionReceipt(config: Configuration, txHash: string): Promise<Result<ethers.TransactionReceipt>> {
    try {
        validateHexString({ hexString: txHash }, 66);
    } catch (e) {
        return { ok: false, code: ErrorCode.TX_REJECTED, error: `invalid transaction hash: ${String(e)}` };
    }

    let receipt: ethers.TransactionReceipt | null;
    try {
        receipt = await withTimeout(rpcProvider(config.rpcUrl, config.chain.id).getTransactionReceipt(txHash));
    } catch (e) {
        return { ok: false, code: ErrorCode.RPC_NETWORK, error: `couldnt get receipt: ${String(e)}`, retryAfterMs: RETRY_AFTER_MS };
    }

    if (!receipt) {
        return { ok: false, code: ErrorCode.TX_PENDING, error: "transaction still pending", retryAfterMs: RETRY_AFTER_MS };
    }
    if (receipt.status !== 1) {
        return { ok: false, code: ErrorCode.TX_REJECTED, error: "transaction reverted" };
    }
    return { ok: true, value: receipt };
}

/**
 * 
 * Creates an election creation transaction and simulates it
 *
 * @param config - Admin client config
 * @param params - Election params and sender
 * @returns prepared transaction or error code
 */
export async function createElection(config: Configuration, params: CreateElectionParams): Promise<Result<PreparedTransaction>> {
    try {
        validateElectionID(params.electionID);
    } catch (e) {
        return { ok: false, code: ErrorCode.TX_REJECTED, error: `invalid election: ${String(e)}` };
    }

    if (params.electionID !== 0) {

        const existingElection: Result<ElectionOnChain> = await getElection(config, params.electionID);
        if (existingElection.ok) return { ok: false, code: ErrorCode.TX_REJECTED, error: `election id ${params.electionID} already taken` };
        if (existingElection.code !== ErrorCode.ELECTION_NOT_FOUND){ // return any other error code from getElection
            return existingElection;
        }

    }

    const args = [
        params.electionID,
        params.votingStartTime,
        params.votingEndTime,
        params.registrationStartTime,
        params.registrationEndTime,
        params.registerID,
        params.apID,
        params.cid,
        params.publicKey,
    ];

    return prepareTransaction(config, params.from, "createOrUpdateElection", args);
}

/**
 * 
 * Retrieves election ID from createElection event logs
 *
 * @param config - Admin client config
 * @param txHash - hash of createElection transaction
 * @returns election ID or error code; TX_PENDING while tx processing
 */
export async function getElectionID(config: Configuration, txHash: string): Promise<Result<number>> {
    const receipt = await getTransactionReceipt(config, txHash);
    if (!receipt.ok){ // transaction not successful or still pending
        return receipt;
    }

    const opnvote = new ethers.Interface(OPNVOTE_ABI);

    for (const log of receipt.value.logs) {

        if (log.address.toLowerCase() !== config.contracts.opnvote.toLowerCase()) continue;
        const event = opnvote.parseLog({ topics: [...log.topics], data: log.data });
        if (event?.name === "ElectionCreated") return { ok: true, value: Number(event.args.electionId) };

    }

    return { ok: false, code: ErrorCode.TX_REJECTED, error: "no ElectionCreated event found in transaction" };
}

/**
 * Retrieves the election coordinator address from opnvote contract
 *
 * @param config - Admin client config
 * @returns the election coordinator address or error code
 */
export async function getElectionCoordinator(config: Configuration): Promise<Result<Address>> {
    const opnvote = new ethers.Contract(config.contracts.opnvote, OPNVOTE_ABI, rpcProvider(config.rpcUrl, config.chain.id));
    try {
        return { ok: true, value: await withTimeout(opnvote.owner()) };
    } catch (e) {
        return { ok: false, code: ErrorCode.RPC_NETWORK, error: `couldn't read election coordinator: ${String(e)}`, retryAfterMs: RETRY_AFTER_MS };
    }
}

/**
 * 
 * Retrieves on-chain election data from opnvote contract
 *
 * @param config - Admin client config
 * @param electionID - election ID
 * @returns on-chain election data or error code
 */
export async function getElection(config: Configuration, electionID: number): Promise<Result<ElectionOnChain>> {
    try {
        validateElectionID(electionID);
    } catch (e) {
        return { ok: false, code: ErrorCode.ELECTION_NOT_FOUND, error: `invalid election id: ${String(e)}` };
    }

    const opnvote = new ethers.Contract(config.contracts.opnvote, OPNVOTE_ABI, rpcProvider(config.rpcUrl, config.chain.id));
    let election: ethers.Result;

    try {
        election = await withTimeout(opnvote.elections(electionID));
    } catch (e) {
        return { ok: false, code: ErrorCode.RPC_NETWORK, error: `couldnt get election: ${String(e)}`, retryAfterMs: RETRY_AFTER_MS };
    }

    if (election.votingStartTime === 0n) {
        return { ok: false, code: ErrorCode.ELECTION_NOT_FOUND, error: `election ID ${electionID} not found. Is the election created?` };
    }
    return {
        ok: true,
        value: {
            electionID,
            cid: election.descriptionIpfsCid,
            publicKey: election.publicKey,
            votingStartTime: Number(election.votingStartTime),
            votingEndTime: Number(election.votingEndTime),
            registerID: Number(election.registerId),
            apID: Number(election.authProviderId),
            status: ELECTION_STATUS[Number(election.status)],
            registerPublicKey: election.registerPubKey,
            totalVotes: Number(election.totalVotes),
        },
    };
}

/**
 * 
 * Creates a transaction to start an election and simulates it
 *
 * @param config - Admin client config
 * @param params - election ID and sender
 * @returns unsigned transaction or error code
 */
export function startElection(config: Configuration, params: ElectionStatusChangeParams): Promise<Result<PreparedTransaction>> {
    return prepareTransaction(config, params.from, "startElection", [params.electionID]);
}

/**
 * 
 * Creates a transaction to end an election and simulates it
 *
 * @param config - Admin client config
 * @param params - election ID and sender
 * @returns unsigned transaction or error code
 */
export function endElection(config: Configuration, params: ElectionStatusChangeParams): Promise<Result<PreparedTransaction>> {
    return prepareTransaction(config, params.from, "endElection", [params.electionID]);
}

/**
 * 
 * Checks if a transaction is confirmed (sucessfull), pending or rejected
 *
 * @param config - Admin client config
 * @param txHash - transaction hash
 * @returns ok:true if the transaction is sucessfully confirmed
 */
export async function getTransactionStatus(config: Configuration, txHash: string): Promise<Result<void>> {

    const receipt = await getTransactionReceipt(config, txHash);
    if (!receipt.ok) return receipt;
    
    return { ok: true, value: undefined };
}

/**
 *
 * Creates a transaction to set the register public key and simulates it
 *
 * @param config - Admin client config
 * @param params - election ID, register public key and sender
 * @returns unsigned transaction or error code
 */
export async function setRegisterPublicKeyOnChain(config: Configuration, params: SetRegisterPublicKeyOnChainParams): Promise<Result<PreparedTransaction>> {
    
    try {
        validateBlsParams({ pk: evmG2ToNoble(params.publicKey) });
    } catch (e) {
        return { ok: false, code: ErrorCode.TX_REJECTED, error: `invalid register public key: ${String(e)}` };
    }

    return prepareTransaction(config, params.from, "setElectionRegisterPublicKey", [params.electionID, params.publicKey]);
}

/**
 * Retrieves a register from opnvote contract
 *
 * @param config - Admin client config
 * @param registerID - register ID
 * @returns register or error code
 */
export async function getRegister(config: Configuration, registerID: number): Promise<Result<Register>> {
    
    try {
        validateRegisterID(registerID);
    } catch (e) {
        return { ok: false, code: ErrorCode.REGISTER_NOT_FOUND, error: `invalid register id: ${String(e)}` };
    }

    const opnvote = new ethers.Contract(config.contracts.opnvote, OPNVOTE_ABI, rpcProvider(config.rpcUrl, config.chain.id));

    let register: ethers.Result;
    try {
        register = await withTimeout(opnvote.registers(registerID));
    } catch (e) {
        return { ok: false, code: ErrorCode.RPC_NETWORK, error: `couldn't get register: ${String(e)}`, retryAfterMs: RETRY_AFTER_MS };
    }

    if (register.owner === ethers.ZeroAddress) {
        return { ok: false, code: ErrorCode.REGISTER_NOT_FOUND, error: `register ${registerID} not found` };
    }
    return { ok: true, value: { id: registerID, name: register.registerName, uri: register.registerUri, owner: register.owner } };
}
