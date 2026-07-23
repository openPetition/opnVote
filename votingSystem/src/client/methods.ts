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
import { OPNVOTE_ABI, PAYMASTER_ABI } from "./abi";
import { RULES_GAS_DEFAULTS, GAS_PRICE_BUFFER_NUM, GAS_PRICE_BUFFER_DEN } from "./gasDefaults";
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
 * @deprecated backup only; on-chain sponsoring is the default. Used only when svsUrl is set
 * Signs an EIP-191 voter signature for the SVS to return signed paymaster data.
 */
async function sponsorViaSvs(
    config: Configuration,
    votingTransaction: VotingTransaction | RecastingVotingTransaction,
    credentials: ElectionCredentials,
): Promise<Result<SponsorData>> {
    let sponsorSignature: string;
    try {
        const messageHash = ethers.hashMessage(JSON.stringify(votingTransaction));
        sponsorSignature = await credentials.voterWallet.signMessage(messageHash);
    } catch (e) {
        return { ok: false, error: `failed to sign sponsor request: ${String(e)}`, retryable: false };
    }
    return postJson<SponsorData>(`${config.endpoints.svsUrl}/api/userOp/sponsor`, {
        votingTransaction,
        voterSignature: { hexString: sponsorSignature },
    });
}

const TOTAL_GAS_LIMIT = Object.values(RULES_GAS_DEFAULTS).reduce((sum, v) => sum + BigInt(v), 0n);

const capsCache = new Map<string, { maxCostCap: bigint; maxFeePerGasCap: bigint }>();

async function getPaymasterCaps(config: Configuration): Promise<{ maxCostCap: bigint; maxFeePerGasCap: bigint } | null> {
    const key = config.contracts.paymaster.toLowerCase();
    const cached = capsCache.get(key);
    if (cached) return cached;
    try {
        const paymaster = new ethers.Contract(
            config.contracts.paymaster,
            PAYMASTER_ABI,
            new ethers.JsonRpcProvider(config.rpcUrl),
        );
        const [maxCostCap, maxFeePerGasCap] = await Promise.all([paymaster.maxCostCap(), paymaster.maxFeePerGasCap()]);
        const caps = { maxCostCap, maxFeePerGasCap };
        capsCache.set(key, caps);
        return caps;
    } catch {
        return null;
    }
}

/**
 * On-chain sponsoring; paymaster enforces sponsoring rules
 */
async function sponsorOnChain(
    config: Configuration,
    voterAddress: string,
): Promise<Result<SponsorData>> {
    try {
        const gasRes = await fetch(config.endpoints.bundlerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "pimlico_getUserOperationGasPrice", params: [], id: 1 }),
        });
        const gasJson = (await gasRes.json()) as { result?: Record<string, { maxFeePerGas: string; maxPriorityFeePerGas: string }> };
        const tier = gasJson?.result?.fast ?? gasJson?.result?.standard;
        if (!tier) {
            return { ok: false, error: "failed to fetch gas price from bundler", retryable: true };
        }
        let maxFeePerGas = (BigInt(tier.maxFeePerGas) * GAS_PRICE_BUFFER_NUM) / GAS_PRICE_BUFFER_DEN;
        let maxPriorityFeePerGas = (BigInt(tier.maxPriorityFeePerGas) * GAS_PRICE_BUFFER_NUM) / GAS_PRICE_BUFFER_DEN;

        const caps = await getPaymasterCaps(config); // non-blocking call
        if (caps) {
            const costCeiling = caps.maxCostCap / TOTAL_GAS_LIMIT;
            const ceiling = caps.maxFeePerGasCap < costCeiling ? caps.maxFeePerGasCap : costCeiling;
            if (BigInt(tier.maxFeePerGas) > ceiling) {
                return { ok: false, error: "gas price too high to sponsor, try again later", retryable: true };
            }
            if (maxFeePerGas > ceiling) maxFeePerGas = ceiling;
            if (maxPriorityFeePerGas > ceiling) maxPriorityFeePerGas = ceiling;
        }

        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        const entryPoint = new ethers.Contract(
            config.contracts.entryPoint,
            ["function getNonce(address sender, uint192 key) view returns (uint256)"],
            provider,
        );
        const nonce: bigint = await entryPoint.getNonce(voterAddress, 0);

        return {
            ok: true,
            value: {
                paymasterData: "0x",
                userOpParams: {
                    ...RULES_GAS_DEFAULTS,
                    maxFeePerGas: maxFeePerGas.toString(),
                    maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
                    nonce: nonce.toString(),
                },
            },
        };
    } catch (e) {
        return { ok: false, error: `failed to prepare on-chain sponsor: ${String(e)}`, retryable: true };
    }
}

/**
 * Encrypts votes, builds the vote transaction and gets it sponsored
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
    try {
        const encryptedVoteRSA = await encryptVotes(votes, coordinatorKey, EncryptionType.RSA);
        const encryptedVoteAES = await encryptVotes(votes, credentials.encryptionKey, EncryptionType.AES);
        votingTransaction =
            kind === "recast"
                ? createVoteRecastTransaction(credentials, encryptedVoteRSA, encryptedVoteAES)
                : createVotingTransaction(credentials, encryptedVoteRSA, encryptedVoteAES);
        voteCalldata = createVoteCalldata(votingTransaction, OPNVOTE_ABI);
    } catch (e) {
        return { ok: false, error: `failed to prepare vote: ${String(e)}`, retryable: false };
    }

    const sponsor = config.endpoints.svsUrl
        ? await sponsorViaSvs(config, votingTransaction, credentials)
        : await sponsorOnChain(config, credentials.voterWallet.address);
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
 * Looks up vote status in subgraph. Without txHash: validates if this voter has cast
 * an initial vote. With txHash: validates if the specific vote transaction is indexed.
 * @param config - Client config
 * @param election - Election context
 * @param params - Credentials and optional tx hash
 * @returns the vote status
 */
export async function checkVote(
    config: Configuration,
    election: Election,
    params: CheckVoteParams,
): Promise<Result<VoteStatus>> {
    const voter = params.credentials.voterWallet.address.toLowerCase();

    const query = params.txHash
        ? `{ voteCasts(where: { voter: "${voter}", transactionHash: "${params.txHash}" }, first: 1) { transactionHash } voteUpdateds(where: { voter: "${voter}", transactionHash: "${params.txHash}" }, first: 1) { transactionHash } }`
        : `{ voteCasts(where: { electionId: "${election.electionID}", voter: "${voter}" }, first: 1) { transactionHash } }`;

    const res = await postJson<{
        voteCasts?: { transactionHash: string }[];
        voteUpdateds?: { transactionHash: string }[];
    }>(config.endpoints.subgraphUrl, { query });
    if (!res.ok) {
        return res;
    }

    const hit = res.value.voteCasts?.[0] ?? res.value.voteUpdateds?.[0];
    return { ok: true, value: { indexed: Boolean(hit), txHash: hit?.transactionHash } };
}
