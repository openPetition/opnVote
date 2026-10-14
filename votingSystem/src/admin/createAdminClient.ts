import { generateElectionKeys, generateRegisterKeys, verifyElectionKeys, verifyRegisterKeys } from "./keys";
import type { AdminClient, Configuration } from "./types";

/**
 * Validates the admin client config
 * @param config - Admin client config
 * @throws if a required field is missing or invalid
 */
function validateSetup(config: Configuration): void {
    if (!config.contracts?.opnvote) throw new Error("contracts.opnvote is required");
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
        generateRegisterKeys,
        verifyElectionKeys,
        verifyRegisterKeys: (keys) => verifyRegisterKeys(config, keys),
    };
}
