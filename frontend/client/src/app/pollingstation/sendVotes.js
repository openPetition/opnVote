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
    const DELEGATION_ADDRESS = '0xe6Cae83BdE06E4c305530e199D7217f42808555B';
    const ENTRY_POINT = '0x4337084d9e255ff0702461cf8895ce9e3b5ff108';
    const PAYMASTER_ADDRESS = '0x53f9b337ce2Ea37D87dBAf0D08a9B931ef9D7eae';
    const OPNVOTE_ADDRESS = '0xa36f6cF07eF1DeD3B8B4283E779A4514E30576a8';
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

    let votingTransaction, votingTransactionFull;
    if (isRecast) {
        votingTransactionFull = createVotingTransactionWithoutSVSSignature(votingCredentials, encryptedVotesRSA, encryptedVotesAES);
    } else {
        votingTransaction = createVotingTransactionWithoutSVSSignature(votingCredentials, encryptedVotesRSA, encryptedVotesAES);
        const msgHash = hashMessage(JSON.stringify(votingTransaction));
        const voterSig = await voterAccount.signMessage({ message: msgHash });

        const voterSignatureObject = {
            hexString: voterSig
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
        accountLogicAddress: DELEGATION_ADDRESS,
        entryPoint: { address: ENTRY_POINT, version: '0.8' },
    })

    const voteCalldata = createVoteCalldata(votingTransactionFull, OPNVOTE_ABI);

    const smartAccountClient = createSmartAccountClient({
        client: publicClient,
        chain: gnosis,
        account: smartAccount,
        paymaster: {
            async getPaymasterStubData() {
                return {
                    paymaster: PAYMASTER_ADDRESS,
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
        calls: [{ to: OPNVOTE_ADDRESS, value: 0n, data: voteCalldata }],
        nonce: BigInt(userOpParams.nonce),
    };
    let userOpHash;
    if (!isDeployed) {
        const eoaNonce = await publicClient.getTransactionCount({ address: voterAccount.address })
        const authorization = await voterAccount.signAuthorization({
            address: DELEGATION_ADDRESS,
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