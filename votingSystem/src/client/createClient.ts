import { generateMasterKey } from "../blind-signature/generateTokens";
import { evmG2ToNoble, validateBlsParams, validateElectionID } from "../utils/utils";
import {
    concatElectionCredentialsForQR,
    qrToElectionCredentials,
} from "../voter-credentials/voterCredentials";
import { checkVote, recastVote, registerVoter, vote } from "./methods";
import type { Configuration, Election, VotingClient } from "./types";

/**
 * Validates the client config
 * @param config - Client config
 * @param election - Election context
 * @throws if a required field is missing or invalid
 */
function validateSetup(config: Configuration, election: Election): void {
    validateElectionID(election.electionID);
    validateBlsParams({ pk: evmG2ToNoble(election.registerPublicKey) });

    if (!election.publicKey) throw new Error("election.publicKey is required");
    if (!config.endpoints.registerUrl) throw new Error("endpoints.registerUrl is required");
    if (!config.endpoints.svsUrl) throw new Error("endpoints.svsUrl is required");
    if (!config.endpoints.subgraphUrl) throw new Error("endpoints.subgraphUrl is required");
    if (!config.rpcUrl) throw new Error("endpoints.rpcUrl is required");
    if (!config.chain) throw new Error("endpoints.chain is required");
}

/**
 * Creates a voter facing client instance for a given election
 * @param config - Client config
 * @param election - Election context
 * @returns A VotingClient bound to the given election
 * @throws if config or election is invalid
 */
export function createClient(config: Configuration, election: Election): VotingClient {
    validateSetup(config, election);

    return {
        electionID: election.electionID,
        generateMasterKey,
        exportCredentials: concatElectionCredentialsForQR,
        importCredentials: qrToElectionCredentials,
        registerVoter: (params) => registerVoter(config, election, params),
        vote: (params) => vote(config, election, params),
        recastVote: (params) => recastVote(config, election, params),
        checkVote: (params) => checkVote(config, election, params),
    };
}
