import { ethers } from "ethers";

/**
 * Public key for vote encryption, encoded in DER format as hexstring
 */
export type PublicKeyDer = string;

/**
 * Private key for vote decryption, encoded in DER format as hexstring
 */
export type PrivateKeyDer = string;


/**
 * Voter Credentials for a specific election.
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
 * Represents a RSA signed Message
 * @property {string} hexString - The signature, encoded as a hexadecimal string (must be "0x" prefixed).
 * @property {boolean} isBlinded - Indicates if the signature is blinded or unblinded. 
 */
export type Signature = {
    hexString: string;
    isBlinded: Boolean;
};

/**
 * Represents an EIP-191 compliant Signature, signed by an ethereum wallet
 * @property {string} hexString - The EIP-191 signature, encoded as a hexadecimal string (must be "0x" prefixed).
 */
export type EthSignature = {
    hexString: string;
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

/**
 *  Collection of encrypted votes
 * @property {string} hexString - Encrypted votes
 */
export type EncryptedVotes = {
    hexString: string;
};

/**
 * Voting transaction to be send to Blockchain
 * @property {number} electionID - ID of the election
 * @property {string} voterAddress -  Ethereum address of voter
 * @property {EncryptedVotes} encryptedVote - Encrypted votes
 * @property {Token} unblindedElectionToken - Unblinded election token of voter
 * @property {Signature} unblindedSignature - Unblinded register signature
 * @property {Signature|null} svsSignature - SVS signature of voting transaction
 */
export type VotingTransaction = {
    electionID: number,
    voterAddress: string,
    encryptedVote: EncryptedVotes,
    unblindedElectionToken: Token,
    unblindedSignature: Signature,
    svsSignature: EthSignature | null
}

/**
 * Recasting Vote transaction to be send to Blockchain
 * @property {number} electionID - ID of the election
 * @property {string} voterAddress -  Ethereum address of voter
 * @property {EncryptedVotes} encryptedVote - Encrypted votes
 */
export type RecastingVotingTransaction = {
    electionID: number,
    voterAddress: string,
    encryptedVote: EncryptedVotes,
}

/**
 * Single vote option
 * @enum {number}
 */
export enum VoteOption {
    Yes = 0,
    No = 1,
    Abstain = 2
}

/**
 * A single unencrypted vote
 * @property {VoteOption} value - Chosen voting option
 */
export type Vote = {
    value: VoteOption;
};
