import { createPublicClient, custom, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createSmartAccountClient } from "permissionless";
import { to7702SimpleSmartAccount } from "permissionless/accounts";
import type { ElectionCredentials } from "../types/types";
import type { Configuration, PreparedVote, Result, VoteResult } from "./types";

/**
 * Builds a custom viem transport
 * @param svsUrl - SVS URL
 * @returns A viem custom transport
 */
function svsForwardTransport(svsUrl: string) {
    return custom({
        async request({ method, params }: { method: string; params?: unknown }) {
            const res = await fetch(`${svsUrl}/api/forward`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
            });
            const json = (await res.json()) as {
                data?: { result?: unknown; error?: unknown };
                error?: unknown;
            };
            if (!res.ok || json.error) {
                throw new Error(`SVS forward [${res.status}]: ${JSON.stringify(json.error ?? json)}`);
            }
            const bundlerResponse = json.data;
            if (!bundlerResponse || bundlerResponse.error) {
                throw new Error(`Bundler error: ${JSON.stringify(bundlerResponse?.error)}`);
            }
            return bundlerResponse.result;
        },
    });
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
    const { contracts, endpoints, chain, rpcUrl } = config;

    try {
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
            bundlerTransport: svsForwardTransport(endpoints.svsUrl),
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

        let userOpHash: Hex;
        if (!(await smartAccount.isDeployed())) {
            const eoaNonce = await publicClient.getTransactionCount({ address: voterAccount.address });
            const authorization = await voterAccount.signAuthorization({
                address: contracts.delegation,
                chainId: chain.id,
                nonce: eoaNonce,
            });
            userOpHash = await smartAccountClient.sendUserOperation({ ...sendParams, authorization });
        } else {
            userOpHash = await smartAccountClient.sendUserOperation(sendParams);
        }

        const receipt = await smartAccountClient.waitForUserOperationReceipt({ hash: userOpHash });
        if (!receipt.success) {
            return {
                ok: false,
                error: `userOp reverted: ${receipt.receipt.transactionHash}`,
                retryable: false,
            };
        }
        return { ok: true, value: { txHash: receipt.receipt.transactionHash, userOpHash } };
    } catch (e) {
        return { ok: false, error: `submit failed: ${String(e)}`, retryable: true };
    }
}
