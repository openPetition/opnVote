import { ethers } from "ethers";

/**
 * Represents the credentials of a voter for a specific election.
 * @property {Signature} unblindedSignature - The unblinded signature of the voter.
 * @property {Token} unblindedElectionToken - The unblinded election token of the voter.
 * @property {ethers.Wallet} voterWallet - The Ethereum wallet of the voter.
 * @property {number} electionID - The ID of the specific election.
 */
export type ElectionCredentials = {
    unblindedSignature: Signature;
    unblindedElectionToken: Token;
    voterWallet: ethers.Wallet;
    electionID: number;
};

/**
 * Represents a Token
 * @property {string} hexValue - The token value, encoded as a hexadecimal string (must be "0x" prefixed).
 * @property {boolean} isMaster - Indicates if the token is a master token. 
 * @property {boolean} isBlinded - Indicates if the token is blinded or unblinded. 
 * 
 */
export type Token = {
    hexString: string;
    isMaster: Boolean;
    isBlinded: Boolean
};

/**
 * Represents r in RSA Blind Signature Scheme
 * @property {string} hexString - The value of r, encoded as a hexadecimal string (must be "0x" prefixed).
 * @property {boolean} isMaster - Indicates if the r is a master r.  
 */
export type R = {
    hexString: string;
    isMaster: Boolean;
};

/**
 * Represents a signed Message
 * @property {string} hexString - The value of r, encoded as a hexadecimal string (must be "0x" prefixed).
 * @property {boolean} isBlinded - Indicates if the signature is blinded or unblinded. 
 */
export type Signature = {
    hexString: string;
    isBlinded: Boolean;
};

/**
 * Represents  RSA cryptographic parameters for signing
 * @property {bigint} N - Modulus in RSA
 * @property {bigint} e - Optional. Public exponent in RSA operations
 * @property {bigint} D - Optional.  Private exponent in RSA operations
 * @property {number} NbitLength - Bit length of the modulus
 */
export type RSAParams = {
    N: bigint;
    e?: bigint;
    D?: bigint;
    NbitLength: number;
}