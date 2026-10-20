import type { Address, Chain, Hex } from "viem";
import type { ErrorCode } from "./errors";
import type { ElectionIpfsData, PrivateKeyDer, PublicKeyDer } from "../types/types";

export type { ElectionIpfsData, ErrorCode };

/**
 * Request results
 */
export type Result<T> =
    | { ok: true; value: T }
    | { ok: false; code: ErrorCode; error: string; retryAfterMs?: number };

/**
 * On-chain contract addresses
 * @property {Address} opnvote - opnvote contract
 */
export type Contracts = {
    opnvote: Address;
};

/**
 * Backend endpoints
 * @property {string} ipfsUrl - IPFS pinning server
 * @property {string} subgraphUrl - Subgraph
 */
export type Endpoints = {
    ipfsUrl?: string;
    subgraphUrl?: string;
};

/**
 * @property {Endpoints} endpoints - backend endpoints
 * @property {Contracts} contracts - contract addresses
 * @property {string} rpcUrl - rpc endpoint
 * @property {Chain} chain - chain
 */
export type Configuration = {
    endpoints?: Endpoints;
    contracts: Contracts;
    rpcUrl: string;
    chain: Chain;
};

/**
 * Election key pair for vote encryption
 * @property {PublicKeyDer} publicKey - Election public key
 * @property {PrivateKeyDer} privateKey - Election private key
 */
export type ElectionKeys = {
    publicKey: PublicKeyDer;
    privateKey: PrivateKeyDer;
};

/**
 * Register key pair for blind signatures
 * @property {string} publicKey - G2 public key in EVM format
 * @property {string} secretKey - Sk as 32-byte hex
 */
export type RegisterKeys = {
    publicKey: string;
    secretKey: string;
};

/**
 * Parameters for pinElection
 * @property {ElectionIpfsData} ipfsData - Election IPFS data
 * @property {string} signature - signature of the pin message
 */
export type PinElectionParams = {
    ipfsData: ElectionIpfsData;
    signature: string;
};

/**
 * Allowed author
 * @property {string} walletAddress - author wallet address
 * @property {string} name - author name and organization
 */
export type Author = {
    walletAddress: string;
    name: string;
};

/**
 * Pinned election data
 * @property {string} cid - ipfs cid
 * @property {string} authorWalletAddress - wallet address of author
 * @property {string} author - name and organization of author
 */
export type PinnedElection = {
    cid: string;
    authorWalletAddress: string;
    author: string;
};

/**
 * Parameters to create the on-chain election
 * @property {Address} from - election coordinator
 * @property {number} electionID - default: 0 (next id)
 * @property {string} cid - ipfs cid
 * @property {PublicKeyDer} publicKey - election pubkey
 * @property {number} votingStartTime - unix timestamp seconds
 * @property {number} votingEndTime - unix timestamp seconds
 * @property {number} registrationStartTime - unix timestamp seconds
 * @property {number} registrationEndTime - unix timestamp seconds
 * @property {number} registerID - register ID
 * @property {number} apID - AP ID
 */
export type CreateElectionParams = {
    from: Address;
    electionID: number;
    cid: string;
    publicKey: PublicKeyDer;
    votingStartTime: number;
    votingEndTime: number;
    registrationStartTime: number;
    registrationEndTime: number;
    registerID: number;
    apID: number;
};

/**
 * @property {Address} to - opn.vote contract address
 * @property {Hex} data - calldata
 */
export type PreparedTx = {
    to: Address;
    data: Hex;
};

export type ElectionStatus = "Pending" | "Active" | "Ended" | "ResultsPublished" | "Canceled";

/**
 * On-chain election
 * @property {number} electionID - election ID
 * @property {string} cid - ipfs cid
 * @property {PublicKeyDer} publicKey - election public key
 * @property {number} votingStartTime - unix timestamp seconds
 * @property {number} votingEndTime - unix timestamp seconds
 * @property {number} registerID - register ID
 * @property {number} apID - AP ID
 * @property {ElectionStatus} status - election status
 * @property {string} registerPublicKey - register public key
 * @property {number} totalVotes - number of votes
 */
export type ElectionOnChain = {
    electionID: number;
    cid: string;
    publicKey: PublicKeyDer;
    votingStartTime: number;
    votingEndTime: number;
    registerID: number;
    apID: number;
    status: ElectionStatus;
    registerPublicKey: string;
    totalVotes: number;
};

/**
 * Start/End Election parameters
 * @property {Address} from - election coordinator
 * @property {number} electionID - election ID
 */
export type ElectionStatusChangeParams = {
    from: Address;
    electionID: number;
};

/**
 * Register
 * @property {number} id - register ID
 * @property {string} name - register name
 * @property {string} uri - register URI
 * @property {Address} owner - register owner
 */
export type Register = {
    id: number;
    name: string;
    uri: string;
    owner: Address;
};

/**
 * AP
 * @property {number} id - ap ID
 * @property {string} name - ap name
 * @property {string} uri - ap URI
 * @property {Address} owner - ap owner
 */
export type Ap = {
    id: number;
    name: string;
    uri: string;
    owner: Address;
};

/**
 * Admin client
 */
export type AdminClient = {
    generateElectionKeys(): Promise<ElectionKeys>;
    generateRegisterKeys(): RegisterKeys;
    verifyElectionKeys(keys: ElectionKeys): Promise<Result<void>>;
    verifyRegisterKeys(keys: RegisterKeys): Promise<Result<void>>;
    getAllowedAuthors(): Promise<Result<Author[]>>;
    createPinMessage(ipfsData: ElectionIpfsData): string;
    pinElection(params: PinElectionParams): Promise<Result<PinnedElection>>;
    createElection(params: CreateElectionParams): Promise<Result<PreparedTx>>;
    getElectionID(txHash: string): Promise<Result<number>>;
    getElectionCoordinator(): Promise<Result<Address>>;
    getElection(electionID: number): Promise<Result<ElectionOnChain>>;
    startElection(params: ElectionStatusChangeParams): Promise<Result<PreparedTx>>;
    endElection(params: ElectionStatusChangeParams): Promise<Result<PreparedTx>>;
    getTransactionStatus(txHash: string): Promise<Result<void>>;
    getRegisters(): Promise<Result<Register[]>>;
    getAps(): Promise<Result<Ap[]>>;
};
