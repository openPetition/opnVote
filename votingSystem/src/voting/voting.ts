
import { ethers } from "ethers";
import { ElectionCredentials, EncryptedVotes, EncryptionKey, EncryptionType, EthSignature, PrivateKeyDer, PublicKeyDer, RecastingVotingTransaction, Vote, VoteOption, VotingTransaction, } from "../types/types";
import { RSA_BIT_LENGTH } from "../utils/constants";
import { getSubtleCrypto, hexToBuffer, stringToVotes, validateCredentials, validateElectionID, validateEncryptedVotes, validateEncryptionKey, validateEthAddress, validateEthSignature, validateRecastingVotingTransaction, validateSignature, validateToken, validateVotes, validateVotingTransaction, votesToString } from '../utils/utils';
import * as crypto from 'crypto'

/**
 * Creates a voting transaction without SVS signature.
 * @param {ElectionCredentials} voterCredentials - Credentials of the voter
 * @param {EncryptedVotes} encryptedVotes - Encrypted votes to be included in voting transaction
 * @returns {VotingTransaction} Voting transaction without SVS signature
 * @throws {Error} If any validation (Signature, EncryptedVotes, Token, Signature, ...) fails
 */
export function createVotingTransactionWithoutSVSSignature(voterCredentials: ElectionCredentials, encryptedVotes: EncryptedVotes): VotingTransaction {

    validateEncryptedVotes(encryptedVotes, EncryptionType.RSA) //todo: add AES
    validateToken(voterCredentials.unblindedElectionToken)
    validateSignature(voterCredentials.unblindedSignature)
    validateEthAddress(voterCredentials.voterWallet.address)

    if (voterCredentials.unblindedElectionToken.isMaster) {
        throw new Error("Voting transaction must not include a Master Token");

    }

    if (voterCredentials.unblindedElectionToken.isBlinded) {
        throw new Error("Voting transaction must not include a blinded Token");

    }

    if (voterCredentials.unblindedSignature.isBlinded) {
        throw new Error("Voting transaction must not include a blinded Signature");

    }

    const votingTransaction: VotingTransaction = {
        electionID: voterCredentials.electionID,
        voterAddress: voterCredentials.voterWallet.address,
        encryptedVote: encryptedVotes,
        unblindedElectionToken: voterCredentials.unblindedElectionToken,
        unblindedSignature: voterCredentials.unblindedSignature,
        svsSignature: null
    }

    validateVotingTransaction(votingTransaction)

    return votingTransaction;
}

/**
 * Adds an SVS signature to an existing voting transaction.
 * @param {VotingTransaction} votingTransaction - Voting transaction to which the signature will be added
 * @param {EthSignature} svsSignature -  EIP-191 compliant SVS signature to be added to the voting transaction
 * @returns {VotingTransaction} Updated voting transaction with SVS signature
 * @throws {Error} If any validation (Signature, EncryptedVotes, Token, Signature, ...) fails
 */
export function addSVSSignatureToVotingTransaction(votingTransaction: VotingTransaction, svsSignature: EthSignature): VotingTransaction {

    if (votingTransaction.svsSignature) {
        throw new Error("Voting Transaction already contains SVS Signature");
    }

    validateVotingTransaction(votingTransaction)
    validateEthSignature(svsSignature)

    return {
        ...votingTransaction,
        svsSignature: svsSignature
    }

}

/**
 * Creates a recasting voting transaction.
 * @param {ElectionCredentials} voterCredentials - Credentials of the voter
 * @param {EncryptedVotes} encryptedVotes - Encrypted votes to be included in the recasting voting transaction
 * @returns {RecastingVotingTransaction} Recasting voting transaction
 * @throws {Error} If any validation (ElectionID, EncryptedVotes, EthAddress) fails
 */
export function createVoteRecastTransaction(voterCredentials: ElectionCredentials, encryptedVotes: EncryptedVotes): RecastingVotingTransaction {
    validateCredentials(voterCredentials)
    validateEncryptedVotes(encryptedVotes, EncryptionType.RSA) //todo: add AES

    const recastingVotingTransaction: RecastingVotingTransaction = {
        electionID: voterCredentials.electionID,
        voterAddress: voterCredentials.voterWallet.address,
        encryptedVote: encryptedVotes,
    }

    validateRecastingVotingTransaction(recastingVotingTransaction)

    return recastingVotingTransaction;
}

//todo: add to EncryptedVotes a type (RSA or AES)
//todo test encryptVotesAES
/**
 * Encrypts an array of votes using AES-GCM.
 * @param {Array<Vote>} votes - Array of votes to encrypt
 * @param {EncryptionKey} encryptionKey - Encryption key in DER format
 * @returns {EncryptedVotes} Encrypted votes
 */
export async function encryptVotesAES(votes: Array<Vote>, encryptionKey: EncryptionKey): Promise<EncryptedVotes> {
    try {
        validateEncryptionKey(encryptionKey, EncryptionType.AES)
        validateVotes(votes, EncryptionType.AES)

        const subtle: SubtleCrypto | crypto.webcrypto.SubtleCrypto = getSubtleCrypto()

        const keyBuffer = Buffer.from(encryptionKey.hexString.substring(2), "hex");
        const iv = ethers.randomBytes(12); // 12 bytes (96 bits)
        const encoder = new TextEncoder();
        const voteBytes = encoder.encode(votesToString(votes));

        const cryptoKey = await subtle.importKey(
            "raw",
            keyBuffer,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt"]
        );
        const encrypted = await subtle.encrypt(
            { name: "AES-GCM", iv },
            cryptoKey,
            voteBytes
        );
        const encryptedHex = ethers.hexlify(Buffer.concat([iv, new Uint8Array(encrypted)]));

        return { hexString: encryptedHex, encryptionType: EncryptionType.AES }
    } catch (error) {
        if (error instanceof Error) {
            throw new Error("Failed to encrypt votes: " + error.message);
        } else {
            throw new Error("Failed to encrypt votes due to an unknown error. Error: " + error);
        }
    }
}

export async function decryptVotesAES(encryptedVotes: EncryptedVotes, encryptionKey: EncryptionKey): Promise<Array<Vote>> {
    try {
        validateEncryptionKey(encryptionKey, EncryptionType.AES)
        validateEncryptedVotes(encryptedVotes, EncryptionType.AES)
        const subtle: SubtleCrypto | crypto.webcrypto.SubtleCrypto = getSubtleCrypto()

        const keyBuffer = Buffer.from(encryptionKey.hexString.substring(2), "hex");
        const encryptedBuffer = Buffer.from(encryptedVotes.hexString.substring(2), "hex");

        const iv = encryptedBuffer.subarray(0, 12);
        const ciphertext = encryptedBuffer.subarray(12);

        const cryptoKey = await subtle.importKey(
            "raw",
            keyBuffer,
            { name: "AES-GCM", length: 256 },
            false,
            ["decrypt"]
        );

        const decryptedBytes = await subtle.decrypt(
            { name: "AES-GCM", iv },
            cryptoKey,
            ciphertext
        );

        const decryptedString = new TextDecoder().decode(decryptedBytes);

        const votes: Array<Vote> = stringToVotes(decryptedString);
        validateVotes(votes, EncryptionType.AES)
        return votes;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error("Failed to decrypt votes: " + error.message);
        } else {
            throw new Error("Failed to decrypt votes due to an unknown error. Error: " + error);
        }
    }
}






//todo: rename to encryptVotesRSA
//todo: Set EncryptionKey type to RSA or AES
/**
 * Encrypts an array of votes using RSA-OAEP with SHA-256 as hash function.
 * @param {Array<Vote>} votes - Array of votes to encrypt
 * @param {PublicKeyDer} publicKeyHex - Election Public key in DER format
 * @returns {EncryptedVotes} Encrypted votes
 * @throws {Error} if no votes are provided or if any error occurs during the encryption process
 */
export async function encryptVotes(votes: Array<Vote>, publicKeyHex: PublicKeyDer): Promise<EncryptedVotes> {
    if (votes.length === 0) {
        throw new Error("Encryption error: No votes provided.");
    }
    try {
        validateVotes(votes, EncryptionType.RSA)
        const subtle: SubtleCrypto | crypto.webcrypto.SubtleCrypto = getSubtleCrypto()
        const publicKeyBuffer = hexToBuffer(publicKeyHex);
        const publicKey = await subtle.importKey(
            'spki',
            publicKeyBuffer,
            {
                name: "RSA-OAEP",
                hash: "SHA-256"
            },
            true,
            ["encrypt"]
        );

        // Validate Key size
        const keyDetails = await subtle.exportKey('jwk', publicKey);
        if (keyDetails.n) {
            const keySize = keyDetails.n.length * 6 / 8; // Approximate bit length
            const expectedKeySize = RSA_BIT_LENGTH / 8;
            if (Math.abs(keySize - expectedKeySize) > 1) {
                throw new Error(`Invalid key size. Expected around ${RSA_BIT_LENGTH} bits, but got approximately ${Math.round(keySize * 8)} bits.`);
            }
        } else {
            throw new Error("Unable to determine key size.");
        }


        const votesString: string = votesToString(votes);
        const buffer = new TextEncoder().encode(votesString);
        const encrypted = await subtle.encrypt(
            {
                name: "RSA-OAEP"
            },
            publicKey,
            buffer
        );
        const encryptedVotes: EncryptedVotes = { hexString: '0x' + Buffer.from(encrypted).toString('hex'), encryptionType: EncryptionType.RSA }
        validateEncryptedVotes(encryptedVotes, EncryptionType.RSA)

        return encryptedVotes;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error("Failed to encrypt votes: " + error.message);
        } else {
            throw new Error("Failed to encrypt votes due to an unknown error. Error: " + error);
        }
    }
}

//todo: rename to decryptVotesRSA
//todo: Set EncryptionKey type to RSA or AES
/**
 * Decrypts a string of encrypted votes using RSA-OAEP with SHA-256.
 * @param {EncryptedVotes} encryptedVotes - Encrypted votes
 * @param {PrivateKeyDer} privateKeyHex - Election Private key in DER format
 * @returns {Array<Vote>} An array of votes
 * @throws {Error} If no valid encrypted data is provided or if any error occurs during the decryption process.
 */
export async function decryptVotes(encryptedVotes: EncryptedVotes, privateKeyHex: PrivateKeyDer): Promise<Array<Vote>> {

    if (!encryptedVotes.hexString || encryptedVotes.hexString.length <= 2 || !encryptedVotes.hexString.startsWith('0x')) {
        throw new Error("Decryption error: No valid encrypted data provided.");
    }
    validateEncryptedVotes(encryptedVotes, EncryptionType.RSA)

    try {
        const subtle: SubtleCrypto | crypto.webcrypto.SubtleCrypto = getSubtleCrypto()
        const privateKeyBuffer = hexToBuffer(privateKeyHex);
        const privateKey = await subtle.importKey(
            'pkcs8',
            privateKeyBuffer,
            {
                name: "RSA-OAEP",
                hash: "SHA-256"
            },
            true,
            ["decrypt"]
        );
        const encryptedBuf = hexToBuffer(encryptedVotes.hexString)
        const decrypted = await subtle.decrypt(
            {
                name: "RSA-OAEP"
            },
            privateKey,
            encryptedBuf
        );
        const votesString = new TextDecoder().decode(decrypted);
        const votes = stringToVotes(votesString)
        validateVotes(votes, EncryptionType.RSA)

        return votes;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error("Failed to decrypt votes: " + error.message);
        } else {
            throw new Error("Failed to decrypt votes due to an unknown error. Error: " + error);
        }

    }
}
