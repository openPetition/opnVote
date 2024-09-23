'use client'
import { Signature } from "votingsystem";

export class AuthorizationError extends Error {}
export class AlreadyVotedError extends Error {}
export class ServerError extends Error {}

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
    if (response.status !== 200) {
        throw new ServerError();
    } 

    const transactionResult = await response.json();
    const taskState = transactionResult.task.taskState;
    if ('lastCheckMessage' in transactionResult.task && transactionResult.task.lastCheckMessage.match(/(Execution error|Task failed after [0-9]+ retries): .*:Already Voted/i)) {
        throw new AlreadyVotedError();
    }

    return {
        status: taskStatesSuccess.includes(taskState) ? 'success' : taskStatesCancelled.includes(taskState) ? 'cancelled' : 'pending',
        error: null,
        transactionHash: transactionResult?.task?.transactionHash ? transactionResult.task.transactionHash : '',
        transactionViewUrl: transactionResult?.task?.transactionHash ? 'https://gnosisscan.io/tx/' + transactionResult.task.transactionHash : '',
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

    const response = await fetch(process.env.signVotingTransactionUrl, signOptions);
    if (response.status !== 200) {
        throw new ServerError();
    }
    const jsondata = await response.json();
    if (jsondata?.data?.blindedSignature) {
        return jsondata.data.blindedSignature;
    }
    if (jsondata?.data?.hexString) {
        return jsondata.data;
    }
    return jsondata;
};

export async function gelatoForward(signatureDataInitialSerialized) {
    const gelatoHeader= new Headers();
    gelatoHeader.append("Content-Type", "application/json");
    const options = {
        method: "POST",
        headers: gelatoHeader,
        body: signatureDataInitialSerialized,
    };

    const response = await fetch(process.env.gelatoForwardUrl, options);
    if (response.status >= 500) {
        throw new ServerError();
    } 
    try {
        return await response.json();
    } catch (e) {
        throw new ServerError();
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
    } catch (error) {
        throw new ServerError();
    }
}