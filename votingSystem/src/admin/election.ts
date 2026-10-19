import { ethers } from "ethers";
import type { Hex } from "viem";
import { validateElectionID, validateEthAddress, validateHexString } from "../utils/utils";
import { rpcProvider, withTimeout } from "../client/utils";
import { ErrorCode, RETRY_AFTER_MS } from "./errors";
import { OPNVOTE_ABI } from "../client/abi";
import type { Configuration, CreateElectionParams, PreparedTx, Result } from "./types";

/**
 * Creates and simulates an on-chain election creation transaction
 *
 * @param config - Admin client config
 * @param params - Election params and sender
 * @returns Result or error code
 */
export async function createElection(config: Configuration, params: CreateElectionParams): Promise<Result<PreparedTx>> {

    const opnvote = new ethers.Contract(config.contracts.opnvote, OPNVOTE_ABI, rpcProvider(config.rpcUrl, config.chain.id));

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

    let calldata: string;
    try {

        validateEthAddress(params.from);
        validateElectionID(params.electionID);
        calldata = opnvote.interface.encodeFunctionData("createOrUpdateElection", args);

    } catch (e) {
        return { ok: false, code: ErrorCode.TX_REJECTED, error: `invalid election: ${String(e)}` };
    }

    try {
        if (params.electionID !== 0) {
            const election = await withTimeout(opnvote.elections(params.electionID));
            if (election.votingStartTime !== 0n) {
                return { ok: false, code: ErrorCode.TX_REJECTED, error: `election id ${params.electionID} already taken` };
            }
        }
        await withTimeout(opnvote.createOrUpdateElection.staticCall(...args, { from: params.from }));

    } catch (e) {

        if (ethers.isError(e, "CALL_EXCEPTION") && e.reason) {
            return { ok: false, code: ErrorCode.TX_REJECTED, error: `contract reverted: ${e.reason}` };
        }
        return { ok: false, code: ErrorCode.RPC_NETWORK, error: `simulation failed: ${String(e)}`, retryAfterMs: RETRY_AFTER_MS };
    }

    return { ok: true, value: { to: config.contracts.opnvote, data: calldata as Hex } };
}

/**
 *
 * Retrieves the election ID from a createElection transaction hash
 *
 * @param config - Admin client config
 * @param txHash - hash of createElection transaction
 * @returns election ID or error code; TX_PENDING while tx processing
 */
export async function getElectionID(config: Configuration, txHash: string): Promise<Result<number>> {
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

    const opnvote = new ethers.Interface(OPNVOTE_ABI);

    for (const log of receipt.logs) {

        if (log.address.toLowerCase() !== config.contracts.opnvote.toLowerCase()) continue;
        const event = opnvote.parseLog({ topics: [...log.topics], data: log.data });
        if (event?.name === "ElectionCreated") return { ok: true, value: Number(event.args.electionId) };

    }

    return { ok: false, code: ErrorCode.TX_REJECTED, error: "no ElectionCreated event found in transaction" };
}
