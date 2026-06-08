import type { Address, Chain } from "viem";
import type {
    ElectionCredentials,
    MasterKey,
    PublicKeyDer,
    RecastingVotingTransaction,
    Vote,
    VotingTransaction,
} from "../types/types";

/**
 * Request results
 */
export type Result<T> =
    | { ok: true; value: T }
    | { ok: false; error: string; retryable: boolean };

/**
 * Endpoints for backend services
 * @property {string} registerUrl - URL of the register
 * @property {string} svsUrl - URL of the SVS
 * @property {string} subgraphUrl - URL of the Subgraph
 */
export type Endpoints = {
    registerUrl: string;
    svsUrl: string;
    subgraphUrl: string;
};

/**
 * On-chain contract addresses
 * @property {Address} opnvote - opnvote contract
 * @property {Address} paymaster - Paymaster contract
 * @property {Address} delegation - EIP-7702 delegation
 * @property {Address} entryPoint - ERC-4337 EntryPoint address
 */
export type Contracts = {
    opnvote: Address;
    paymaster: Address;
    delegation: Address;
    entryPoint: Address;
};

/**
 * Static client configuration
 * @property {Endpoints} endpoints - Backend endpoints
 * @property {Contracts} contracts - On-chain contract addresses
 * @property {string} rpcUrl - JSON-RPC endpoint
 * @property {Chain} chain - Target chain
 */
export type Configuration = {
    endpoints: Endpoints;
    contracts: Contracts;
    rpcUrl: string;
    chain: Chain;
};

/**
 * Election context
 * @property {number} electionID - election ID
 * @property {PublicKeyDer} publicKey - Election Public Key
 * @property {string} registerPublicKey - Register BLS G2 public key in EVM format
 */
export type Election = {
    electionID: number;
    publicKey: PublicKeyDer;
    registerPublicKey: string;
};

/**
 * Gas and paymaster parameters returned by SVS
 */
export type SponsorData = {
    paymasterData: string;
    userOpParams: {
        nonce: string;
        callGasLimit: string;
        verificationGasLimit: string;
        preVerificationGas: string;
        paymasterVerificationGasLimit: string;
        paymasterPostOpGasLimit: string;
        maxFeePerGas: string;
        maxPriorityFeePerGas: string;
    };
};

/**
 * A signed, sponsored vote, ready for on-chain submission
 * @property {string} kind - "vote" initial vote or "recast"
 * @property {string} voteCalldata - Encoded vote() calldata
 * @property {string} voterAddress - Election wallet address
 * @property {SponsorData} sponsor - SVS sponsor response
 */
export type PreparedVote = {
    kind: "vote" | "recast";
    votingTransaction: VotingTransaction | RecastingVotingTransaction;
    voteCalldata: string;
    voterAddress: string;
    sponsor: SponsorData;
};

/**
 * Result of a successful on-chain submission
 * @property {string} txHash - Transaction hash
 * @property {string} userOpHash - ERC-4337 user-operation hash
 */
export type VoteResult = {
    txHash: string;
    userOpHash: string;
};

/**
 * Subgraph-derived status of a vote
 * @property {boolean} indexed - Without txHash: any vote of this voter is indexed. With txHash: the exact vote transaction is indexed
 * @property {string} txHash - Transaction hash, if indexed
 */
export type VoteStatus = {
    indexed: boolean;
    txHash?: string;
};

/**
 * Parameters for registerVoter
 * @property {string} voterJwt - Voter auth token (from AP)
 * @property {MasterKey} masterKey - Optional master key
 */
export type RegisterVoterParams = {
    voterJwt: string;
    masterKey?: MasterKey;
};

/**
 * Parameters for vote and recastVote
 * @property {ElectionCredentials} credentials - Voter credentials from registerVoter
 * @property {Vote[]} votes - The votes to cast
 */
export type VoteParams = {
    credentials: ElectionCredentials;
    votes: Vote[];
};

/**
 * Parameters for checkVote
 * @property {ElectionCredentials} credentials - Voter credentials
 * @property {string} txHash - Optional tx hash
 */
export type CheckVoteParams = {
    credentials: ElectionCredentials;
    txHash?: string;
};

/**
 * Public client
 */
export type VotingClient = {
    electionID: number;
    generateMasterKey(): MasterKey;
    registerVoter(params: RegisterVoterParams): Promise<Result<ElectionCredentials>>;
    exportCredentials(credentials: ElectionCredentials): string;
    importCredentials(serialized: string): ElectionCredentials;
    vote(params: VoteParams): Promise<Result<VoteResult>>;
    recastVote(params: VoteParams): Promise<Result<VoteResult>>;
    checkVote(params: CheckVoteParams): Promise<Result<VoteStatus>>;
};
