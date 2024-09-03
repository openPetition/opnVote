'use client'

import { ethers } from "ethers";
import { signTransaction, gelatoForward, getAbi } from '../../service';
import { GelatoRelay } from "@gelatonetwork/relay-sdk";
import { createSignatureData,createRelayRequest, encryptVotes, createVotingTransactionWithoutSVSSignature, addSVSSignatureToVotingTransaction } from "votingsystem";

const replacer = function(key, value) {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
}

export async function sendVotes(votes, votingCredentials, electionPublicKey) {
    // map votes into needed format
    let newVoteArray = [];
    Object.keys(votes).map((key) => {
        newVoteArray[key]  = {value: votes[key]};
    });
    const encryptedVotes = await encryptVotes(newVoteArray, electionPublicKey);

    const votingTransaction = createVotingTransactionWithoutSVSSignature(votingCredentials, encryptedVotes);
    const voterWallet = new ethers.Wallet(votingCredentials.voterWallet.privateKey);
    const message = JSON.stringify(votingTransaction);
    const messageHash = ethers.hashMessage(message);

    const voterSignature = await voterWallet.signMessage(messageHash);
    const voterSignatureObject = {
        hexString: voterSignature
    };
    const svsSignature = await signTransaction(votingTransaction, voterSignatureObject);
    
    const votingTransactionFull = addSVSSignatureToVotingTransaction(votingTransaction, svsSignature);
    
    const abiData = await getAbi();
    const opnVoteInterface = new ethers.Interface(abiData['abi']);

    const provider = new ethers.JsonRpcProvider("https://distinguished-solitary-surf.xdai.quiknode.pro/77a783462f3e4f1756cf55e4023fd0db6fdebf8b/"); // lets talk where to put all this stuff in biweekly - its on the list
    const relayRequest = await createRelayRequest(votingTransactionFull, votingCredentials, "0xB2971419Bb6437856Eb9Ec8CA3e56958Af45Eee9", opnVoteInterface, provider);
    const relay = new GelatoRelay();
    const signatureDataInitial = await createSignatureData(relayRequest, votingCredentials, relay, provider);

    const signatureDataInitialSerialized = JSON.stringify(signatureDataInitial, replacer);
    const gelatoForwardResult = await gelatoForward(signatureDataInitialSerialized);
    console.log(gelatoForwardResult); //we get task id - stored in blockcain. / we still have to check wether all is good ( already voted or other)
    // https://api.gelato.digital/tasks/status/0x49706c72b75170f5445ad4b5c96cd13afe7a5c4a90859e992279a9074d293170 to check next?
    return;
}