import { createPublicClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createSmartAccountClient } from "permissionless";
import { to7702SimpleSmartAccount } from "permissionless/accounts";
import type { ElectionCredentials } from "../types/types";
import type { Configuration, PreparedVote, Result, VoteResult } from "./types";

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
