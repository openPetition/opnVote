'use client';

import { ethers } from "ethers";
import { signTransaction, gelatoForward, getAbi } from '../../service';
import Config from "../../../next.config.mjs";
import { GelatoRelay } from "@gelatonetwork/relay-sdk";
import { createSignatureData, createRelayRequest, encryptVotes, createVotingTransactionWithoutSVSSignature, addSVSSignatureToVotingTransaction, createVoteRecastTransaction, EncryptionType } from "votingsystem";

const replacer = function (key, value) {
    if (typeof value === 'bigint') {
        return value.toString();
    }
    return value;
}

export async function sendVotes(votes, votingCredentials, electionPublicKey, isRecast) {
    // map votes into needed format
    let newVoteArray = [];
    Object.keys(votes).map((key) => {
        newVoteArray[key] = { value: votes[key] };
    });

    const encryptedVotesAES = await encryptVotes(newVoteArray, votingCredentials.encryptionKey, EncryptionType.AES);
    const encryptedVotesRSA = await encryptVotes(newVoteArray, { hexString: electionPublicKey, encryptionType: EncryptionType.RSA }, EncryptionType.RSA);

    let votingTransaction, votingTransactionFull;
    if (isRecast) {
        votingTransactionFull = createVoteRecastTransaction(votingCredentials, encryptedVotesRSA, encryptedVotesAES);
    } else {
        votingTransaction = createVotingTransactionWithoutSVSSignature(votingCredentials, encryptedVotesRSA, encryptedVotesAES);
        const voterWallet = new ethers.Wallet(votingCredentials.voterWallet.privateKey);
        const message = JSON.stringify(votingTransaction);
        const messageHash = ethers.hashMessage(message);

        const voterSignature = await voterWallet.signMessage(messageHash);
        const voterSignatureObject = {
            hexString: voterSignature
        };
        const svsSignature = await signTransaction(votingTransaction, voterSignatureObject);
        votingTransactionFull = addSVSSignatureToVotingTransaction(votingTransaction, svsSignature);
    }

    const abiData = await getAbi();
    const opnVoteInterface = new ethers.Interface(abiData);

    const provider = new ethers.JsonRpcProvider("https://gnosis-mainnet.g.alchemy.com/v2/MBXWJJ3MwzGKwdgULrX7vgJd5BF_pDsZ"); // lets talk where to put all this stuff in biweekly - its on the list
    const relayRequest = await createRelayRequest(votingTransactionFull, votingCredentials, Config.env.opnVoteContractAddress, opnVoteInterface, provider);
    const relay = new GelatoRelay();
    const signatureDataInitial = await createSignatureData(relayRequest, votingCredentials, relay, provider);

    const signatureDataInitialSerialized = JSON.stringify(signatureDataInitial, replacer);
    const gelatoForwardResult = await gelatoForward(signatureDataInitialSerialized);

    return gelatoForwardResult.data.taskId;
}