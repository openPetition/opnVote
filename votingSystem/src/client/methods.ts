import { ethers } from "ethers";
import {
    blindToken,
    deriveElectionUnblindedToken,
    deriveElectionWallet,
    generateBlindingR,
    generateMasterKey,
    unblindSignature,
    verifyUnblindedSignature,
} from "../blind-signature/generateTokens";
import { createVoterCredentials } from "../voter-credentials/voterCredentials";
import { createVoteCalldata } from "../blockchain/bundler";
import {
    createVoteRecastTransaction,
    createVotingTransaction,
    encryptVotes,
} from "../voting/voting";
import { evmG2ToNoble } from "../utils/utils";
import {
    EncryptionType,
    type BlsParams,
    type ElectionCredentials,
    type EncryptionKey,
    type RecastingVotingTransaction,
    type VotingTransaction,
} from "../types/types";
import { OPNVOTE_ABI } from "./abi";
import type {
    CheckVoteParams,
    Configuration,
    Election,
    PreparedVote,
    RegisterVoterParams,
    Result,
    SponsorData,
    VoteParams,
    VoteResult,
    VoteStatus,
} from "./types";

/**
 * Sends POST-Request as JSON to backend or subgraph endpoint; Returns the data field
 * @param url - Endpoint URL
 * @param body - Request body
 * @param headers - Optional extra headers
 * @returns Result with the response data
 */
async function postJson<T>(
    url: string,
    body: unknown,
    headers: Record<string, string> = {},
): Promise<Result<T>> {
    let res: Response;
    try {
        res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify(body),
        });
    } catch (e) {
        return { ok: false, error: `network error: ${String(e)}`, retryable: true };
    }

    const json = (await res.json().catch(() => undefined)) as { data?: T; error?: unknown } | undefined;
    if (!res.ok) {
        const retryable = res.status >= 500 || res.status === 429;
        return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(json)}`, retryable };
    }
    if (json?.error) {
        return { ok: false, error: `API error: ${JSON.stringify(json.error)}`, retryable: false };
    }
    return { ok: true, value: (json?.data ?? json) as T };
}

/**
 * Registers a voter; derives election wallet and token, blinds the token, lets register
 * sign it, unblinds and verifies the signature
 * @param config - Client config
 * @param election - Election context
 * @param params - Voter JWT and optional master key
 * @returns Result with voter credentials
 */
export async function registerVoter(
    config: Configuration,
    election: Election,
    params: RegisterVoterParams,
): Promise<Result<ElectionCredentials>> {
    const masterKey = params.masterKey ?? generateMasterKey();
    const wallet = deriveElectionWallet(masterKey, election.electionID);
    const unblindedToken = deriveElectionUnblindedToken(election.electionID, wallet.address);
    const r = generateBlindingR();
    const blindedToken = blindToken(unblindedToken, r);

    const signed = await postJson<{ blindedSignature: string }>(
        `${config.endpoints.registerUrl}/api/sign`,
        { token: blindedToken },
        { Authorization: `Bearer ${params.voterJwt}` },
    );
    if (!signed.ok) {
        return signed;
    }

    const unblindedSignature = unblindSignature({ hexString: signed.value.blindedSignature, isBlinded: true }, r);
    const blsParams: BlsParams = { pk: evmG2ToNoble(election.registerPublicKey) };
    if (!verifyUnblindedSignature(unblindedSignature, unblindedToken, blsParams)) {
        return { ok: false, error: "unblinded signature failed BLS verification", retryable: false };
    }

    return { ok: true, value: createVoterCredentials(unblindedSignature, masterKey, election.electionID) };
}

/**
 * Encrypts votes, builds and signs transaction, gets it sponsored by SVS
 * @param config - Client config
 * @param election - Election context
 * @param params - Credentials and votes
 * @param kind - "vote" (initial vote) or "recast"
 * @returns a prepared, sponsored vote ready for submission
 */
async function prepare(
    config: Configuration,
    election: Election,
    params: VoteParams,
    kind: "vote" | "recast",
): Promise<Result<PreparedVote>> {
    const { credentials, votes } = params;
    const coordinatorKey: EncryptionKey = {
        hexString: election.publicKey,
        encryptionType: EncryptionType.RSA,
    };

    let votingTransaction: VotingTransaction | RecastingVotingTransaction;
    let voteCalldata: string;
    let sponsorSignature: string;
    try {
        const encryptedVoteRSA = await encryptVotes(votes, coordinatorKey, EncryptionType.RSA);
        const encryptedVoteAES = await encryptVotes(votes, credentials.encryptionKey, EncryptionType.AES);
        votingTransaction =
            kind === "recast"
                ? createVoteRecastTransaction(credentials, encryptedVoteRSA, encryptedVoteAES)
                : createVotingTransaction(credentials, encryptedVoteRSA, encryptedVoteAES);
        voteCalldata = createVoteCalldata(votingTransaction, OPNVOTE_ABI);

        // EIP-191 sign for svs request
        const messageHash = ethers.hashMessage(JSON.stringify(votingTransaction));
        sponsorSignature = await credentials.voterWallet.signMessage(messageHash);
    } catch (e) {
        return { ok: false, error: `failed to prepare vote: ${String(e)}`, retryable: false };
    }

    const sponsor = await postJson<SponsorData>(`${config.endpoints.svsUrl}/api/userOp/sponsor`, {
        votingTransaction,
        voterSignature: { hexString: sponsorSignature },
    });
    if (!sponsor.ok) {
        return sponsor;
    }

    return {
        ok: true,
        value: {
            kind,
            votingTransaction,
            voteCalldata,
            voterAddress: credentials.voterWallet.address,
            sponsor: sponsor.value,
        },
    };
}

/**
 * Prepares and submits initial vote on-chain
 * @param config - Client configuration
 * @param election - Election context
 * @param params - Credentials and votes
 * @returns on-chain submission result
 */
export async function vote(
    config: Configuration,
    election: Election,
    params: VoteParams,
): Promise<Result<VoteResult>> {
    const prepared = await prepare(config, election, params, "vote");
    if (!prepared.ok) {
        return prepared;
    }
    const { submit } = await import("./submit");
    return submit(config, prepared.value, params.credentials);
}

/**
 * Prepares and submits a vote recast on-chain (no BLS signature needed)
 * @param config - Client config
 * @param election - Election context
 * @param params - Credentials and votes
 * @returns on-chain submission result
 */
export async function recastVote(
    config: Configuration,
    election: Election,
    params: VoteParams,
): Promise<Result<VoteResult>> {
    const prepared = await prepare(config, election, params, "recast");
    if (!prepared.ok) {
        return prepared;
    }
    const { submit } = await import("./submit");
    return submit(config, prepared.value, params.credentials);
}

/**
 * Looks up if the (recast) vote is indexed in subgraph
 * @param config - Client config
 * @param election - Election context
 * @param params - Credentials and optional kind ("vote" or "recast")
 * @returns the vote status
 */
export async function checkVote(
    config: Configuration,
    election: Election,
    params: CheckVoteParams,
): Promise<Result<VoteStatus>> {
    const voter = params.credentials.voterWallet.address.toLowerCase();
    const kind = params.kind ?? "vote";

    const query =
        kind === "recast"
            ? `{ voteUpdateds(where: { electionId: "${election.electionID}", voter: "${voter}" }, orderBy: blockNumber, orderDirection: desc, first: 1) { transactionHash } }`
            : `{ voteCasts(where: { electionId: "${election.electionID}", voter: "${voter}" }, first: 1) { transactionHash } }`;

    const res = await postJson<{
        voteCasts?: { transactionHash: string }[];
        voteUpdateds?: { transactionHash: string }[];
    }>(config.endpoints.subgraphUrl, { query });
    if (!res.ok) {
        return res;
    }

    const rows = kind === "recast" ? res.value.voteUpdateds : res.value.voteCasts;
    const hit = rows && rows.length > 0 ? rows[0] : undefined;
    return { ok: true, value: { indexed: Boolean(hit), txHash: hit?.transactionHash } };
}
