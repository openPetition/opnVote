import { ethers } from "ethers";
import { fetchWithTimeout } from "../client/utils";
import { ErrorCode, RETRY_AFTER_MS } from "./errors";
import type { Ap, Configuration, Register, Result } from "./types";

const PAGE_SIZE = 1000;

/**
 * Election in subgraph
 * @property {string} contractAddress - opnvote contract
 * @property {string} cid - ipfs cid
 * @property {string} descriptionBlob - ipfs data
 */
export type SubgraphElection = {
    contractAddress: string;
    cid: string;
    descriptionBlob: string;
};

/**
 * VoteCast or VoteUpdated event in subgraph
 * @property {string} id - entity ID
 * @property {string} voter - voter address
 * @property {string} voteEncrypted - votes encrypted with the election public key
 * @property {string} blockNumber - block number
 */
export type SubgraphVote = {
    id: string;
    voter: string;
    voteEncrypted: string;
    blockNumber: string;
};

/**
 *
 * Fetches registers or APs from subgraph
 *
 * @param config - Admin client config
 * @param query - GraphQL query
 * @returns registers/aps sorted by ID or error code
 */
async function querySubgraph(config: Configuration, query: string): Promise<Result<(Register | Ap)[]>> {
    if (!config.endpoints?.subgraphUrl) throw new Error("endpoints.subgraphUrl is not defined");

    let res: Response;
    try {
        res = await fetchWithTimeout(config.endpoints.subgraphUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
        });
    } catch (e) {
        return { ok: false, code: ErrorCode.SUBGRAPH_ERROR, error: `network error: ${String(e)}`, retryAfterMs: RETRY_AFTER_MS };
    }

    if (!res.ok) {
        const error = `HTTP ${res.status}: ${await res.text().catch(() => "")}`;
        const retryable = res.status >= 500 || res.status === 429;
        return { ok: false, code: ErrorCode.SUBGRAPH_ERROR, error, retryAfterMs: retryable ? RETRY_AFTER_MS : undefined };
    }

    const json = await res.json().catch(() => undefined);
    const items = json?.data?.items;

    if (!Array.isArray(items)) {
        return { ok: false, code: ErrorCode.SUBGRAPH_ERROR, error: `response is empty: ${JSON.stringify(json?.errors)}`, retryAfterMs: RETRY_AFTER_MS };
    }
    const sorted = items.map((item) => ({ ...item, id: Number(item.id) })).sort((a, b) => a.id - b.id);
    return { ok: true, value: sorted };
}

/**
 * Fetch registers
 *
 * @param config - Admin client config
 * @returns registers sorted by ID or error code
 */
export function getRegisters(config: Configuration): Promise<Result<Register[]>> {
    return querySubgraph(config, "{ items: registers(first: 100) { id name: registerName uri: registerUri owner } }");
}

/**
 * Fetch APs
 *
 * @param config - Admin client config
 * @returns APs sorted by ID or error code
 */
export function getAps(config: Configuration): Promise<Result<Ap[]>> {
    return querySubgraph(config, "{ items: authorizationProviders(first: 100) { id name: apName uri: apUri owner } }");
}

/**
 * Fatch a subgraph query
 * @param config - Admin client config
 * @param query - GraphQL query
 * @param variables - GraphQL variables
 * @returns response data or error code
 */
async function fetchSubgraph<T>(config: Configuration, query: string, variables: Record<string, string>): Promise<Result<T>> {
    if (!config.endpoints?.subgraphUrl) throw new Error("endpoints.subgraphUrl not defined");

    let res: Response;
    try {
        res = await fetchWithTimeout(config.endpoints.subgraphUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, variables }),
        });
    } catch (e) {
        return { ok: false, code: ErrorCode.SUBGRAPH_ERROR, error: `network error: ${String(e)}`, retryAfterMs: RETRY_AFTER_MS };
    }

    if (!res.ok) {
        const error = `HTTP ${res.status}: ${await res.text().catch(() => "")}`;
        const retryable = res.status >= 500 || res.status === 429;
        return { ok: false, code: ErrorCode.SUBGRAPH_ERROR, error, retryAfterMs: retryable ? RETRY_AFTER_MS : undefined };
    }

    const json = await res.json().catch(() => undefined);
    if (!json?.data || json.errors) {
        return { ok: false, code: ErrorCode.SUBGRAPH_ERROR, error: `invalid subgraph response: ${JSON.stringify(json?.errors)}`, retryAfterMs: RETRY_AFTER_MS };
    }
    return { ok: true, value: json.data };
}

/**
 * Fetch election contract and description
 *
 * @param config - Admin client config
 * @param electionID - election ID
 * @returns indexed contract, ipfs cid and ipfs data of the election or error code
 */
export async function getSubgraphElectionDescriptionAndAddress(config: Configuration, electionID: number): Promise<Result<SubgraphElection>> {
    const res = await fetchSubgraph<{ election: SubgraphElection | null }>(
        config,
        "query($id: ID!) { election(id: $id) { contractAddress cid: descriptionIpfsCid descriptionBlob } }",
        { id: String(electionID) },
    );
    if (!res.ok) return res;

    if (!res.value.election) {
        return { ok: false, code: ErrorCode.SUBGRAPH_ERROR, error: `election ${electionID} not found in subgraph`, retryAfterMs: RETRY_AFTER_MS };
    }
    return { ok: true, value: res.value.election };
}

/**
 * Fetch all VoteCasts and VoteUpdated events of an election
 *
 * @param config - Admin client config
 * @param event - voteCasts or voteUpdateds
 * @param electionID - election ID
 * @returns all events or error code
 */
export async function getSubgraphVotes(config: Configuration, event: "voteCasts" | "voteUpdateds", electionID: number): Promise<Result<SubgraphVote[]>> {
    const query = `query($electionID: BigInt!, $lastID: Bytes!) {
        votes: ${event}(first: ${PAGE_SIZE}, orderBy: id, orderDirection: asc, where: { electionId: $electionID, id_gt: $lastID }) {
            id voter voteEncrypted blockNumber
        }
    }`;

    const votes: SubgraphVote[] = [];
    let lastID = "0x";
    let previousIDs = new Set<string>(); // IDs of previous page, to detect irregular subgraph behavior

    while (true) {
        const res = await fetchSubgraph<{ votes: SubgraphVote[] }>(config, query, { electionID: String(electionID), lastID });
        if (!res.ok) return res;

        const page = res.value.votes;
        if (!Array.isArray(page)) {
            return { ok: false, code: ErrorCode.SUBGRAPH_ERROR, error: `did not find ${event} in subgraph response`, retryAfterMs: RETRY_AFTER_MS };
        }

        const pageIDs = new Set<string>();
        for (const vote of page) {
            if (!hasValidSubgraphVoteFormat(vote)){
                return { ok: false, code: ErrorCode.SUBGRAPH_ERROR, error: `invalid subgraph vote in ${event}: ${JSON.stringify(vote)}` };
            }

            if (previousIDs.has(vote.id)) { // each page should have unique vote IDs
                return { ok: false, code: ErrorCode.SUBGRAPH_ERROR, error: `subgraph returned same ID ${vote.id} for ${event} on two pages` };
            }

            pageIDs.add(vote.id);
            votes.push(vote);
        }

        if (page.length < PAGE_SIZE){
            return { ok: true, value: votes };
        }

        previousIDs = pageIDs;
        lastID = page[page.length - 1].id;
    }
}

/**
 * Check the format of vote events
 *
 * @param vote - vote event
 * @returns true if format is as expected
 */
function hasValidSubgraphVoteFormat(vote: SubgraphVote): boolean {
    return ethers.isHexString(vote?.id, true)
        && ethers.isAddress(vote.voter)
        && ethers.isHexString(vote.voteEncrypted, true)
        && /^\d+$/.test(vote.blockNumber);
}
