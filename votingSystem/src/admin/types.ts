import type { Address, Chain } from "viem";
import type { ErrorCode } from "./errors";
import type { PrivateKeyDer, PublicKeyDer } from "../types/types";

export type { ErrorCode };

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
 * @property {Contracts} contracts - contract addresses
 * @property {string} rpcUrl - rpc endpoint
 * @property {Chain} chain - chain
 */
export type Configuration = {
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
 * Admin client
 */
export type AdminClient = {
    generateElectionKeys(): Promise<ElectionKeys>;
    generateRegisterKeys(): RegisterKeys;
    verifyElectionKeys(keys: ElectionKeys): Promise<Result<void>>;
    verifyRegisterKeys(keys: RegisterKeys): Promise<Result<void>>;
};
