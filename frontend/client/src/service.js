'use client'
import { Signature } from "votingsystem";

/** @returns {Signature} */
export async function getBlindedSignature(jwttoken, blindedElectionToken) {
    const blindedElectionTokenFormatted = {token: blindedElectionToken};
    const signOptions = {
        method: "POST",
        headers: new Headers(
            {
                'content-type': 'application/json',
                'Authorization': 'Bearer ' + jwttoken 
            }
        ),
        body: JSON.stringify(blindedElectionTokenFormatted)
    };
 
    const response = await fetch(process.env.blindedSignatureUrl, signOptions);
    const jsondata = await response.json();
    return {hexString: jsondata.data.blindedSignature, isBlinded: true};
}

export async function getTransactionState(taskId) {

    const taskStatesSuccess = [ "ExecSuccess" ];
    const taskStatesCancelled = [  "ExecReverted", "Cancelled" ];

    const transactionStateUrl = 'https://api.gelato.digital/tasks/status/' + taskId;
    const options = {
        method: "GET",
        headers: new Headers(
            {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        ),
    };
    const response = await fetch(transactionStateUrl, options);
    const transactionResult = await response.json();
    const taskState = transactionResult.task.taskState;

    return {
        status: taskStatesSuccess.includes(taskState) ? 'success' : taskStatesCancelled.includes(taskState) ? 'cancelled' : 'pending',
        transactionHash: transactionResult.task.transactionHash ? transactionResult?.task?.transactionHash : '',
        transactionViewUrl: transactionResult.task.transactionHash ? 'https://gnosisscan.io/tx/' + transactionResult?.task?.transactionHash : '',
    };
}

export async function signTransaction(votingTransaction, voterSignatureObject) {
    const votingTransactionToSign = {"votingTransaction": JSON.stringify(votingTransaction)};
    const signHeader= new Headers();
    signHeader.append("Content-Type", "application/json");

    const signOptions = {
        method: "POST",
        headers: signHeader,
        body: JSON.stringify({votingTransaction, voterSignature: voterSignatureObject}),

    };

    try {
        const response = await fetch(process.env.signVotingTransactionUrl, signOptions);
        const jsondata = await response.json()
        return jsondata.data;
    } catch(error) {
        console.error(error);
    }
};

export async function gelatoForward(signatureDataInitialSerialized) {
    const gelatoHeader= new Headers();
    gelatoHeader.append("Content-Type", "application/json");
    const options = {
        method: "POST",
        headers: gelatoHeader,
        body: signatureDataInitialSerialized,
    };
    try {
        const response = await fetch(process.env.gelatoForwardUrl, options);
        const jsondata = await response.json()
        return jsondata;
    } catch(error) {
        console.error(error);
    }
}

export async function getAbi() {
    const getHeader= new Headers();
    getHeader.append("Content-Type", "application/json");
    const options = {
        method: "GET",
        headers: getHeader,
    };
    try {
        const response = await fetch(process.env.abiConfigUrl, options);
        const jsondata = await response.json()
        return jsondata;
    } catch(error) {
        console.error(error);
    }
}