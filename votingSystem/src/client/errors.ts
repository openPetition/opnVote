export enum ErrorCode {
    REG_NETWORK = "REG_NETWORK", // Register Network Error
    REG_REJECTED = "REG_REJECTED", // Register Refused Request
    REG_JWT_INVALID = "REG_JWT_INVALID", // Invalid Voter JWT
    REG_BLS_VERIFY_FAILED = "REG_BLS_VERIFY_FAILED", // BLS Verification Failed
    SUBGRAPH_ERROR = "SUBGRAPH_ERROR", // Subgraph query or network error
    VOTE_NETWORK = "VOTE_NETWORK", // RPC or bundler network error
    VOTE_GASPRICE_TOO_HIGH = "VOTE_GASPRICE_TOO_HIGH", // Gas price too high
    VOTE_INVALID = "VOTE_INVALID", // Invalid vote (e.g. wrong voter)
    VOTE_REVERTED = "VOTE_REVERTED", // Smart-Contract reverted the vote
    VOTE_PENDING = "VOTE_PENDING", // Vote is pending confirmation
}

export const RETRY_AFTER_MS = 3_000;
export const RETRY_AFTER_GASPRICE_MS = 3_000;
