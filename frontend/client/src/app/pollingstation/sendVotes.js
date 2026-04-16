'use client';

import { signTransaction, fetchSponsor, createSvsForwardTransport } from '../../service';
import { hashMessage, createPublicClient, http } from 'viem';
import { gnosis } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import Config from "../../../next.config.mjs";
import {
    encryptVotes, createVoteCalldata, createVotingTransactionWithoutSVSSignature, addSVSSignatureToVotingTransaction, createVoteRecastTransaction, EncryptionType,
} from "votingsystem";
import { createSmartAccountClient } from 'permissionless';
import { to7702SimpleSmartAccount } from 'permissionless/accounts';

export async function sendVotes(votes, votingCredentials, electionPublicKey, isRecast) {
    // map votes into needed format
    const voterAccount = privateKeyToAccount(votingCredentials.voterWallet.privateKey);
    const OPNVOTE_ABI = [
        {
            type: 'function',
            name: 'vote',
            inputs: [
                { name: 'electionId', type: 'uint256' },
                { name: 'voter', type: 'address' },
                { name: 'svsSignature', type: 'bytes' },
                { name: 'voteEncrypted', type: 'bytes' },
                { name: 'voteEncryptedUser', type: 'bytes' },
                { name: 'unblindedElectionToken', type: 'bytes' },
                { name: 'unblindedSignature', type: 'bytes' },
            ],
            outputs: [],
            stateMutability: 'nonpayable',
        },
    ];

    let newVoteArray = [];
    Object.keys(votes).map((key) => {
        newVoteArray[key] = { value: votes[key] };
    });

    const encryptedVotesAES = await encryptVotes(newVoteArray, votingCredentials.encryptionKey, EncryptionType.AES);
    const encryptedVotesRSA = await encryptVotes(newVoteArray, { hexString: electionPublicKey, encryptionType: EncryptionType.RSA }, EncryptionType.RSA);

    const votingTransaction = createVotingTransactionWithoutSVSSignature(votingCredentials, encryptedVotesRSA, encryptedVotesAES);
    let votingTransactionFull;
    if (isRecast) {
        // on recast transaction must not be signed by svs again
        votingTransactionFull = votingTransaction;
    } else {
        const msgHash = hashMessage(JSON.stringify(votingTransaction));
        const voterSignature = await voterAccount.signMessage({ message: msgHash });

        const voterSignatureObject = {
            hexString: voterSignature
        };
        const svsSignature = await signTransaction(votingTransaction, voterSignatureObject);
        votingTransactionFull = addSVSSignatureToVotingTransaction(votingTransaction, svsSignature.data.svsSignature);

    }
    const sponsorMsgHash = hashMessage(JSON.stringify(votingTransactionFull));
    const sponsorSig = await voterAccount.signMessage({ message: sponsorMsgHash });

    const { paymasterData, userOpParams } = await fetchSponsor(votingTransactionFull, sponsorSig);

    const publicClient = createPublicClient({
        chain: gnosis,
        transport: http(Config.env.rpcnodeUrl),
    })

    const smartAccount = await to7702SimpleSmartAccount({
        client: publicClient,
        owner: voterAccount,
        accountLogicAddress: Config.env.delegationAddress,
        entryPoint: { address: Config.env.entryPoint, version: '0.8' },
    })

    const voteCalldata = createVoteCalldata(votingTransactionFull, OPNVOTE_ABI);

    const smartAccountClient = createSmartAccountClient({
        client: publicClient,
        chain: gnosis,
        account: smartAccount,
        paymaster: {
            async getPaymasterStubData() {
                return {
                    paymaster: Config.env.paymasterAddress,
                    paymasterData,
                    isFinal: true,
                    callGasLimit: BigInt(userOpParams.callGasLimit),
                    verificationGasLimit: BigInt(userOpParams.verificationGasLimit),
                    preVerificationGas: BigInt(userOpParams.preVerificationGas),
                    paymasterVerificationGasLimit: BigInt(userOpParams.paymasterVerificationGasLimit),
                    paymasterPostOpGasLimit: BigInt(userOpParams.paymasterPostOpGasLimit),
                }
            },
            async getPaymasterData() {
                throw new Error('getPaymasterData should not be called when isFinal: true');
            },
        },
        bundlerTransport: createSvsForwardTransport(),
        userOperation: {
            estimateFeesPerGas: async () => ({
                maxFeePerGas: BigInt(userOpParams.maxFeePerGas),
                maxPriorityFeePerGas: BigInt(userOpParams.maxPriorityFeePerGas),
            }),
        },
    })

    const isDeployed = await smartAccount.isDeployed();
    const sendParams = {
        calls: [{ to: Config.env.opnVoteContractAddress, value: 0n, data: voteCalldata }],
        nonce: BigInt(userOpParams.nonce),
    };
    let userOpHash;
    if (!isDeployed) {
        const eoaNonce = await publicClient.getTransactionCount({ address: voterAccount.address })
        const authorization = await voterAccount.signAuthorization({
            address: Config.env.delegationAddress,
            chainId: gnosis.id,
            nonce: eoaNonce,
        })
        userOpHash = await smartAccountClient.sendUserOperation({ ...sendParams, authorization });
    } else {
        userOpHash = await smartAccountClient.sendUserOperation(sendParams);
    }

    const receipt = await smartAccountClient.waitForUserOperationReceipt({ hash: userOpHash });
    const txHash = receipt.receipt.transactionHash;

    if (!receipt.success) {
        throw new Error(`UserOp reverted: ${txHash}`);
    }
    return txHash;
}