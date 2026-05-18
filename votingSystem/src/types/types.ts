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
 * @property {BlsSignature} unblindedSignature - The unblinded signature of the voter.
 * @property {ethers.Wallet} voterWallet - The Ethereum wallet of the voter.
 * @property {EncryptionKey} encryptionKey - The encryption key for vote encryption.
 * @property {number} electionID - The ID of the specific election.
 */
export type ElectionCredentials = {
    unblindedSignature: BlsSignature;
    voterWallet: ethers.Wallet;
    encryptionKey: EncryptionKey;
    electionID: number;
};

/**
 * Election token
 * @property {string} hexString - Token value as hex string ('0x'-prefixed)
 * @property {boolean} isBlinded - Defines if token is blinded or unblinded
 */
export type Token = {
    hexString: string;
    isBlinded: boolean;
};

/**
 * The blinding factor R used in the BLS blind-signature scheme
 * @property {string} hexString - The value of r (hexstring, '0x'-prefixed)
 */
export type R = {
    hexString: string;
};

/**
 * Represents the master secret from which per-election credentials are derived
 * @property {string} hexString - Master key as hex string ('0x' prefixed)
 */
export type MasterKey = {
    hexString: string;
};

/**
 * BLS blind-signature scheme signature (G1 point as uncompressed hex)
 * @property {string} hexString - Signature as hex string ('0x' prefixed)
 * @property {boolean} isBlinded - Whether the signature is still blinded
 */
export type BlsSignature = {
    hexString: string;
    isBlinded: boolean;
};

/**
 * Represents an encryption key for user encrypted votes.
 * @property {string} hexString - The encryption key as a hexadecimal string with '0x' prefix.
 */
export type EncryptionKey = {
    hexString: string;
    encryptionType: EncryptionType;
};

/**
 * Represents a wallet private key
 * @property {string} hexString - The private key as a hexadecimal string with '0x' prefix.
 */
export type WalletPrivateKey = {
    hexString: string;
};

/**
 * Represents an EIP-191 compliant Signature
 * @property {string} hexString - The EIP-191 signature as a hexadecimal string with '0x' prefix.
 */
export type EthSignature = {
    hexString: string;
};



/**
 * Uncompressed BLS12-381 keys
 * @property {string} pk - Public key (uncompressed G2 point) 
 * @property {bigint} sk - Optional, private skalar
 */
export type BlsParams = {
    pk: string;
    sk?: bigint;
}

/**
 * Collection of encrypted votes
 * @property {string} hexString - The encrypted votes as a hexadecimal string with '0x' prefix
 * @property {EncryptionType} encryptionType - The type of encryption used
 */
export type EncryptedVotes = {
    hexString: string;
    encryptionType: EncryptionType;
};


export enum EncryptionType {
    AES = "AES",
    RSA = "RSA"
}

/**
 * Voting transaction to be send to Blockchain
 * @property {number} electionID - ID of the election
 * @property {string} voterAddress - Election-specific wallet address (msg.sender)
 * @property {EncryptedVotes} encryptedVoteRSA - RSA-encrypted votes
 * @property {EncryptedVotes} encryptedVoteAES - AES-encrypted votes
 * @property {BlsSignature} unblindedSignature - Unblinded BLS register signature
 */
export type VotingTransaction = {
    electionID: number,
    voterAddress: string,
    encryptedVoteRSA: EncryptedVotes,
    encryptedVoteAES: EncryptedVotes,
    unblindedSignature: BlsSignature,
}

/**
 * Recasting Vote transaction to be send to Blockchain
 * @property {number} electionID - ID of the election
 * @property {string} voterAddress -  Ethereum address of voter
 * @property {EncryptedVotes} encryptedVoteRSA - Encrypted votes RSA
 * @property {EncryptedVotes} encryptedVoteAES - Encrypted votes AES
 */
export type RecastingVotingTransaction = {
    electionID: number,
    voterAddress: string,
    encryptedVoteRSA: EncryptedVotes,
    encryptedVoteAES: EncryptedVotes,
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
