import type { Address, Chain } from "viem";
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
 */
export type Endpoints = {
    ipfsUrl?: string;
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
};
