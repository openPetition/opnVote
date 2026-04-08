'use client'
import { Signature } from "votingsystem"; // eslint-disable-line
import Config from "../next.config.mjs";
import globalConst from "@/constants";
import { custom } from 'viem';

export class AuthorizationError extends Error { }
export class AlreadyVotedError extends Error { }
export class ServerError extends Error { }

/** @returns {Signature} */
export async function getBlindedSignature(jwttoken, blindedElectionToken) {
    const blindedElectionTokenFormatted = { token: blindedElectionToken };
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

    const response = await fetch(Config.env.blindedSignatureUrl, signOptions);
    const jsondata = await response.json();
    if (jsondata.error?.length > 0) {
        switch (jsondata.error.toLowerCase()) {
            case 'already registered':
                throw new ServerError(globalConst.ERROR.ALREADYREGISTERED);
                break;
            case 'failed to authenticate jwt':
                throw new ServerError(globalConst.ERROR.JWTAUTH);
                break;
            default:
                throw new ServerError(globalConst.ERROR.GENERAL);
                break;
        }
    }

    return { hexString: jsondata.data.blindedSignature, isBlinded: true };
}

export async function querySubgraphTransactionState(election_id, voterAddress) {
    const query = `{ voteCasts(where: { electionId: "${election_id}", voter: "${voterAddress}" }, first: 1) { transactionHash } }`;
    const header = new Headers();
    header.append("Content-Type", "application/json");

    const res = await fetch(Config.env.graphConnectUrl, {
        method: 'POST',
        headers: header,
        body: JSON.stringify({ query }),
    })

    const json = (await res.json())
    if (!res.ok || json.errors) {
        throw new Error(`Subgraph error: ${JSON.stringify(json.errors ?? json)}`)
    }
    return json.data
}

export async function signTransaction(votingTransaction, voterSignatureObject) {
    const signHeader = new Headers();
    signHeader.append("Content-Type", "application/json");

    const signOptions = {
        method: "POST",
        headers: signHeader,
        body: JSON.stringify({ votingTransaction, voterSignature: voterSignatureObject }),
    };

    const response = await fetch(Config.env.signVotingTransactionUrl, signOptions);
    if (response.status !== 200) {
        throw new ServerError();
    }
    console.log(response);
    console.log('signTransaction');
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
    const gelatoHeader = new Headers();
    gelatoHeader.append("Content-Type", "application/json");
    const options = {
        method: "POST",
        headers: gelatoHeader,
        body: signatureDataInitialSerialized,
    };

    const response = await fetch(Config.env.gelatoForwardUrl, options);
    if (response.status >= 500) {
        throw new ServerError();
    }
    try {
        return await response.json();
    } catch (error) {
        throw new ServerError();
    }
}

export async function getAbi() {
    const getHeader = new Headers();
    getHeader.append("Content-Type", "application/json");
    const options = {
        method: "GET",
        headers: getHeader,
    };
    try {
        const response = await fetch(Config.env.abiConfigUrl, options);
        const jsondata = await response.json();
        return jsondata;
    } catch (error) {
        throw new ServerError();
    }
}

export async function gelatoVerify(taskId) {
    const gelatoHeader = new Headers();
    gelatoHeader.append("Content-Type", "application/json");
    const options = {
        method: "GET",
        headers: gelatoHeader,
    };
    const gelatoVerifyUrl = Config.env.gelatoVerifyUrl + taskId;
    const response = await fetch(gelatoVerifyUrl, options);
    if (response.status >= 500) {
        throw new ServerError();
    }
    try {
        return await response.json();
    } catch (error) {
        throw new ServerError();
    }
}


export function createSvsForwardTransport() {
    console.log('svsforwardtransport');
    return custom({
        async request({ method, params }) {
            const res = await fetch(Config.env.svsForwardTransportUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
            })
            const json = (await res.json())
            if (!res.ok || json.error)
                throw new Error(`SVS forward [${res.status}]: ${json.error ?? JSON.stringify(json)}`)
            const bundlerResponse = json.data
            if (bundlerResponse.error)
                throw new Error(`Bundler error: ${JSON.stringify(bundlerResponse.error)}`)
            return bundlerResponse.result
        },
    })
}

/** @returns {{
    paymasterData: Hex
    userOpParams: {
      nonce: string
      callGasLimit: string
      verificationGasLimit: string
      preVerificationGas: string
      paymasterVerificationGasLimit: string
      paymasterPostOpGasLimit: string
      maxFeePerGas: string
      maxPriorityFeePerGas: string
    }}
} */
export async function fetchSponsor(votingTransactionFull, sponsorSig) {
    console.log('keks 1');
    console.log(sponsorSig);
    const fetchOptions = {
        method: "POST",
        headers: new Headers(
            {
                'content-type': 'application/json'
            }
        ),
        body: JSON.stringify({ votingTransaction: votingTransactionFull, voterSignature: { hexString: sponsorSig } })
    };
    console.log('keks 2');
    const response = await fetch(Config.env.svsFetchSponsorUrl, fetchOptions);
    const jsondata = await response.json();
    if (jsondata.error?.length > 0) {
        switch (jsondata.error.toLowerCase()) {
            case 'already registered':
                throw new ServerError(globalConst.ERROR.ALREADYREGISTERED);
                break;
            case 'failed to authenticate jwt':
                throw new ServerError(globalConst.ERROR.JWTAUTH);
                break;
            default:
                throw new ServerError(globalConst.ERROR.GENERAL);
                break;
        }
    }

    return jsondata.data;
}
