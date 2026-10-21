import { generateElectionKeys, generateRegisterKeys, verifyElectionKeys, verifyRegisterKeys } from "./keys";
import { createPinMessage, getAllowedAuthors, pinElection } from "./ipfs";
import { createElection, endElection, getElection, getElectionCoordinator, getElectionID, getRegister, getTransactionStatus, publishElectionResults, setRegisterPublicKeyOnChain, startElection } from "./election";
import { createRegisterKeysMessage, setRegisterKeysBackend } from "./register";
import { getAps, getRegisters } from "./subgraph";
import { fundPaymaster, getPaymaster } from "./paymaster";
import { tallyElection } from "./tally";
import type { AdminClient, Configuration } from "./types";

/**
 * Validates the admin client config
 * @param config - Admin client config
 * @throws if a required field is missing or invalid
 */
function validateSetup(config: Configuration): void {
    if (!config.contracts?.opnvote) throw new Error("contracts.opnvote is required");
    if (!config.contracts?.paymaster) throw new Error("contracts.paymaster is required");
    if (!config.rpcUrl) throw new Error("config.rpcUrl is required");
    if (!config.chain) throw new Error("config.chain is required");
}

/**
 * Creates an admin facing client instance
 * @param config - Admin client config
 * @returns An AdminClient
 * @throws if config is invalid
 */
export function createAdminClient(config: Configuration): AdminClient {
    validateSetup(config);

    return {
        generateElectionKeys,
        verifyElectionKeys,
        getAllowedAuthors: () => getAllowedAuthors(config),
        createPinMessage,
        pinElection: (params) => pinElection(config, params),
        getRegisters: () => getRegisters(config),
        getAps: () => getAps(config),
        getElectionCoordinator: () => getElectionCoordinator(config),
        createElection: (params) => createElection(config, params),
        getElectionID: (txHash) => getElectionID(config, txHash),
        getElection: (electionID) => getElection(config, electionID),
        startElection: (params) => startElection(config, params),
        endElection: (params) => endElection(config, params),
        tallyElection: (params) => tallyElection(config, params),
        publishElectionResults: (params) => publishElectionResults(config, params),
        getTransactionStatus: (txHash) => getTransactionStatus(config, txHash),
        generateRegisterKeys,
        verifyRegisterKeys: (keys) => verifyRegisterKeys(config, keys),
        getRegister: (registerID) => getRegister(config, registerID),
        setRegisterPublicKeyOnChain: (params) => setRegisterPublicKeyOnChain(config, params),
        createRegisterKeysMessage,
        setRegisterKeysBackend: (params) => setRegisterKeysBackend(config, params),
        getPaymaster: () => getPaymaster(config),
        fundPaymaster: (params) => fundPaymaster(config, params),
    };
}
