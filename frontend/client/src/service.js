'use client'
import { Agent } from 'https';
import { Signature } from "votingsystem";

const httpsAgent =  new Agent({
    rejectUnauthorized: false,
 });

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
        body: JSON.stringify(blindedElectionTokenFormatted),
        agent: httpsAgent
    };
 
    const response = await fetch(process.env.blindedSignatureUrl, signOptions);
    const jsondata = await response.json();
    return {hexString: jsondata.data.blindedSignature, isBlinded: true};
}

export async function signTransaction(votingTransaction, voterSignatureObject) {
    const votingTransactionToSign = {"votingTransaction": JSON.stringify(votingTransaction)};
    const signHeader= new Headers();
    signHeader.append("Content-Type", "application/json");

    const signOptions = {
        method: "POST",
        headers: signHeader,
        body: JSON.stringify({votingTransactionToSign, voterSignature: voterSignatureObject}),
        agent: httpsAgent
    };

    try {
        const response = await fetch(process.env.signVotingTransactionUrl, signOptions);
        const jsondata = await response.json()
        return jsondata.data;
    } catch(error) {
        console.error(error);
    }
};