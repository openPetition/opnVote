import { ethers } from "ethers";
import { EncryptionType, VoteOption } from "../types/types";
import type { QuestionResult, Vote } from "../types/types";
import { decryptVotes } from "../voting/voting";
import { rpcProvider, withTimeout } from "../client/utils";
import { OPNVOTE_ABI } from "../client/abi";
import { validateKeyPair } from "./generateKeyPair";
import { ErrorCode, RETRY_AFTER_MS } from "./errors";
import { getElection } from "./election";
import { getSubgraphElectionDescriptionAndAddress, getSubgraphVotes, type SubgraphVote } from "./subgraph";
import type { Configuration, Result, TallyElectionParams } from "./types";

const VOTE_FORMAT_VERSION = 2;

const OPTION_FIELDS: Record<VoteOption, "yes" | "no" | "abstain" | "invalid"> = {
    [VoteOption.Yes]: "yes",
    [VoteOption.No]: "no",
    [VoteOption.Abstain]: "abstain",
    [VoteOption.Invalid]: "invalid",
};

/**
 * Fetch the last vote per voter
 *
 * @param voteCasts - VoteCast events
 * @param voteUpdates - VoteUpdated events
 * @returns last vote of a voter or error code
 */
function getLastVotes(voteCasts: SubgraphVote[], voteUpdates: SubgraphVote[]): Result<string[]> {
    const lastVotes = new Map<string, { voteEncrypted: string; blockNumber: number; recast: boolean }>();

    for (const vote of voteCasts) {

        const voter = vote.voter.toLowerCase();
        if (lastVotes.has(voter)) {
            return { ok: false, code: ErrorCode.SUBGRAPH_ERROR, error: `duplicate VoteCast event found for voter ${voter}` };
        }

        lastVotes.set(voter, { voteEncrypted: vote.voteEncrypted, blockNumber: Number(vote.blockNumber), recast: false });
    }

    const sortedUpdates = [...voteUpdates];
    sortedUpdates.sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));

    for (const vote of sortedUpdates) {
        const voter = vote.voter.toLowerCase();
        const existing = lastVotes.get(voter);

        if (!existing) {
            return { ok: false, code: ErrorCode.SUBGRAPH_ERROR, error: `VoteUpdated for voter ${voter} but no initial VoteCast exists` };
        }

        if (existing.recast && existing.blockNumber === Number(vote.blockNumber)) {
            return { ok: false, code: ErrorCode.SUBGRAPH_ERROR, error: `more than one vote recast for voter ${voter} in block ${vote.blockNumber}` };
        }

        lastVotes.set(voter, { voteEncrypted: vote.voteEncrypted, blockNumber: Number(vote.blockNumber), recast: true });
    }

    const ballots: string[] = [];
    for (const vote of lastVotes.values()) {
        ballots.push(vote.voteEncrypted);
    }

    return { ok: true, value: ballots };
}

/**
 * Decrypt and count votes
 * Votes that cannot be decrypted are counted as invalidTechnical
 *
 * @param ballots - encrypted votes
 * @param privateKey - election private key
 * @param numberOfQuestions - number of questions
 * @returns result per question
 */
async function countVotes(ballots: string[], privateKey: string, numberOfQuestions: number): Promise<QuestionResult[]> {
    
    const results: QuestionResult[] = [];
    for (let i = 0; i < numberOfQuestions; i++) {
        results.push({ yes: 0, no: 0, abstain: 0, invalid: 0, invalidTechnical: 0 });
    }

    let invalidTechnical = 0;
    for (const ballot of ballots) {
        let votes: Vote[];

        try {
            votes = await decryptVotes(
                { hexString: ballot, encryptionType: EncryptionType.RSA },
                { hexString: privateKey, encryptionType: EncryptionType.RSA },
                EncryptionType.RSA,
                VOTE_FORMAT_VERSION,
                numberOfQuestions,
            );

        } catch {
            invalidTechnical++;
            continue;
        }

        const valid = votes.length === numberOfQuestions && votes.every((vote) => typeof vote?.value === "number" && VoteOption[vote.value] !== undefined);
        
        if (!valid) {
            invalidTechnical++;
            continue;
        }

        for (let i = 0; i < numberOfQuestions; i++) {

            const field = OPTION_FIELDS[votes[i].value];
            results[i][field]++;

        }
    }

    for (const result of results) {
        result.invalidTechnical = invalidTechnical;
    }

    return results;
}

/**
 * Tally an election
 *
 * @param config - Admin client config
 * @param params - election ID and election private key
 * @returns result per question or error code
 */
export async function tallyElection(config: Configuration, params: TallyElectionParams): Promise<Result<QuestionResult[]>> {
    
    const election = await getElection(config, params.electionID);
    if (!election.ok) return election;

    if (election.value.status !== "Ended") {
        return { ok: false, code: ErrorCode.ELECTION_NOT_ENDED, error: `election status is not "Ended": ${election.value.status}` };
    }

    try {
        await validateKeyPair(election.value.publicKey, params.privateKey);
    } catch (e) {
        return { ok: false, code: ErrorCode.KEY_INVALID, error: `private key does not match the election public key: ${String(e)}` };
    }

    let totalVoteUpdates: number;
    try {
        const opnvote = new ethers.Contract(config.contracts.opnvote, OPNVOTE_ABI, rpcProvider(config.rpcUrl, config.chain.id));
        totalVoteUpdates = Number(await withTimeout(opnvote.totalVoteUpdates(params.electionID)));
    } catch (e) {
        return { ok: false, code: ErrorCode.RPC_NETWORK, error: `could not get total vote updates from chain: ${String(e)}`, retryAfterMs: RETRY_AFTER_MS };
    }

    const subgraphElection = await getSubgraphElectionDescriptionAndAddress(config, params.electionID);
    if (!subgraphElection.ok) return subgraphElection;

    if (subgraphElection.value.contractAddress?.toLowerCase() !== config.contracts.opnvote.toLowerCase()) {
        return { ok: false, code: ErrorCode.SUBGRAPH_ERROR, error: `subgraph contract and config contract do not match` };
    }

    if (subgraphElection.value.cid !== election.value.cid) {
        return { ok: false, code: ErrorCode.SUBGRAPH_ERROR, error: `subgraph cid and contract cid do not match` };
    }

    let questions: unknown;
    try {
        questions = JSON.parse(subgraphElection.value.descriptionBlob).questions;
    } catch (e) {
        return { ok: false, code: ErrorCode.SUBGRAPH_ERROR, error: `cannot parse election description: ${String(e)}` };
    }

    if (!Array.isArray(questions) || questions.length === 0) {
        return { ok: false, code: ErrorCode.SUBGRAPH_ERROR, error: "no questions in election data" };
    }

    const voteCasts = await getSubgraphVotes(config, "voteCasts", params.electionID);
    if (!voteCasts.ok) return voteCasts;

    const voteUpdates = await getSubgraphVotes(config, "voteUpdateds", params.electionID);
    if (!voteUpdates.ok) return voteUpdates;

    if (voteCasts.value.length !== election.value.totalVotes || voteUpdates.value.length !== totalVoteUpdates) {
        return {
            ok: false,
            code: ErrorCode.SUBGRAPH_ERROR,
            error: `subgraph and contract are not synced! Subgraph: ${voteCasts.value.length}/${election.value.totalVotes} votes, ${voteUpdates.value.length}/${totalVoteUpdates} vote recasts`,
            retryAfterMs: RETRY_AFTER_MS,
        };
    }

    const ballots = getLastVotes(voteCasts.value, voteUpdates.value);
    if (!ballots.ok) return ballots;

    return { ok: true, value: await countVotes(ballots.value, params.privateKey, questions.length) };
}
