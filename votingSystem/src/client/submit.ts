import { createPublicClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createSmartAccountClient } from "permissionless";
import { to7702SimpleSmartAccount } from "permissionless/accounts";
import type { ElectionCredentials } from "../types/types";
import type { Configuration, PreparedVote, Result, VoteResult } from "./types";
import { ErrorCode, RETRY_AFTER_MS } from "./errors";
import { sleep } from "./utils";

const RECEIPT_POLL_ATTEMPTS = 10;
const RECEIPT_POLL_INTERVAL_MS = 5_000;

/**
 * Builds smart account client and the send parameters
 * @param config - Client config
 * @param prepared - A prepared, sponsored vote
 * @param credentials - Voter credentials
 * @returns the smart accountclient and sendUserOperation parameters
 */
async function setupClient(config: Configuration, prepared: PreparedVote, credentials: ElectionCredentials) {
    const { contracts, endpoints, chain, rpcUrl } = config;
    const voterAccount = privateKeyToAccount(credentials.voterWallet.privateKey as Hex);
    const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

    const smartAccount = await to7702SimpleSmartAccount({
        client: publicClient,
        owner: voterAccount,
        accountLogicAddress: contracts.delegation,
        entryPoint: { address: contracts.entryPoint, version: "0.8" },
    });

    const { paymasterData, userOpParams } = prepared.sponsor;
    const smartAccountClient = createSmartAccountClient({
        client: publicClient,
        chain,
        account: smartAccount,
        paymaster: {
            async getPaymasterStubData() {
                return {
                    paymaster: contracts.paymaster,
                    paymasterData: paymasterData as Hex,
                    isFinal: true as const,
                    callGasLimit: BigInt(userOpParams.callGasLimit),
                    verificationGasLimit: BigInt(userOpParams.verificationGasLimit),
                    preVerificationGas: BigInt(userOpParams.preVerificationGas),
                    paymasterVerificationGasLimit: BigInt(userOpParams.paymasterVerificationGasLimit),
                    paymasterPostOpGasLimit: BigInt(userOpParams.paymasterPostOpGasLimit),
                };
            },
            async getPaymasterData() {
                throw new Error("getPaymasterData cannot be called when isFinal: true");
            },
        },
        bundlerTransport: http(endpoints.bundlerUrl),
        userOperation: {
            estimateFeesPerGas: async () => ({
                maxFeePerGas: BigInt(userOpParams.maxFeePerGas),
                maxPriorityFeePerGas: BigInt(userOpParams.maxPriorityFeePerGas),
            }),
        },
    });

    const sendParams = {
        calls: [
            { to: contracts.opnvote, value: 0n, data: prepared.voteCalldata as Hex },
        ] as const,
        nonce: BigInt(userOpParams.nonce),
    };

    if (!(await smartAccount.isDeployed())) {
        // first vote of wallet
        const eoaNonce = await publicClient.getTransactionCount({ address: voterAccount.address });
        const authorization = await voterAccount.signAuthorization({
            address: contracts.delegation,
            chainId: chain.id,
            nonce: eoaNonce,
        });
        return { smartAccountClient, sendParams: { ...sendParams, authorization } };
    }
    // Vote recast
    return { smartAccountClient, sendParams };
}

/**
 * Submits a prepared, sponsored vote via ERC-4337 + EIP-7702
 * @param config - Client config
 * @param prepared - A prepared, sponsored vote
 * @param credentials - Voter credentials
 * @returns Result with on-chain submission result
 */
export async function submit(
    config: Configuration,
    prepared: PreparedVote,
    credentials: ElectionCredentials,
): Promise<Result<VoteResult>> {
    let smartAccountAndParams: Awaited<ReturnType<typeof setupClient>>;
    try {
        smartAccountAndParams = await setupClient(config, prepared, credentials);
    } catch (e) {
        return { ok: false, code: ErrorCode.VOTE_NETWORK, error: `smart account setup failed: ${String(e)}`, retryAfterMs: RETRY_AFTER_MS };
    }

    const { smartAccountClient, sendParams } = smartAccountAndParams;

    let userOpHash: Hex;
    try {
        userOpHash = await smartAccountClient.sendUserOperation(sendParams);
    } catch (e) {
        const messages: string[] = [];
        let cause: unknown = e;
        while (cause instanceof Error) {
            messages.push(cause.message);
            cause = (cause as { cause?: unknown }).cause;
        }
        const errorText = messages.join("\n") || String(e);
        const error = `sending vote failed: ${String(e)}`;

        if (errorText.includes("Election is not active")) return { ok: false, code: ErrorCode.VOTE_ELECTION_INACTIVE, error };
        if (errorText.includes("Already voted")) return { ok: false, code: ErrorCode.VOTE_ALREADY_CAST, error };
        if (errorText.includes("took too long")) return { ok: false, code: ErrorCode.VOTE_PENDING, error };
        if (errorText.includes("Status: 403")) return { ok: false, code: ErrorCode.VOTE_INVALID, error };
        if (["AA31", "paymaster throttled", "stake too low"].some((s) => errorText.includes(s))) {
            return { ok: false, code: ErrorCode.VOTE_SPONSOR_UNAVAILABLE, error, retryAfterMs: RETRY_AFTER_MS };
        }
        if (errorText.includes("AA33")) return { ok: false, code: ErrorCode.VOTE_INVALID, error };
        return { ok: false, code: ErrorCode.VOTE_NETWORK, error, retryAfterMs: RETRY_AFTER_MS };
    }

    return {
        ok: true,
        value: { userOpHash },
    };
}
