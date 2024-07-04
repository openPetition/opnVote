
import { ElectionCredentials, EncryptedVotes, EthSignature, PrivateKeyDer, PublicKeyDer, RecastingVotingTransaction, Vote, VoteOption, VotingTransaction, } from "../types/types";
import { getSubtleCrypto, validateElectionID, validateEncryptedVotes, validateEthAddress, validateRecastingVotingTransaction, validateSignature, validateToken, validateVotingTransaction } from '../utils/utils';
import * as crypto from 'crypto'

/**
 * Creates a voting transaction without SVS signature.
 * @param {ElectionCredentials} voterCredentials - Credentials of the voter
 * @param {EncryptedVotes} encryptedVotes - Encrypted votes to be included in voting transaction
 * @returns {VotingTransaction} Voting transaction without SVS signature
 * @throws {Error} if any validation (Signature, EncryptedVotes, Token, Signature, ...) fails
 */
export function createVotingTransactionWithoutSVSSignature(voterCredentials: ElectionCredentials, encryptedVotes: EncryptedVotes): VotingTransaction {

    validateEncryptedVotes(encryptedVotes)
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
 * @throws {Error} if any validation (Signature, EncryptedVotes, Token, Signature, ...) fails
 */
export function addSVSSignatureToVotingTransaction(votingTransaction: VotingTransaction, svsSignature: EthSignature): VotingTransaction {

    if (votingTransaction.svsSignature) {
        throw new Error("Voting Transaction already contains SVS Signature");
    }

    validateVotingTransaction(votingTransaction)
    // validateSignature(svsSignature) //todo: Add Validation for EIP 191 compliant Signature

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
 * @throws {Error} if any validation (ElectionID, EncryptedVotes, EthAddress) fails
 */
export function createVoteRecastTransaction(voterCredentials: ElectionCredentials, encryptedVotes: EncryptedVotes): RecastingVotingTransaction {
    validateEncryptedVotes(encryptedVotes)
    validateEthAddress(voterCredentials.voterWallet.address)
    validateElectionID(voterCredentials.electionID)


    const recastingVotingTransaction: RecastingVotingTransaction = {
        electionID: voterCredentials.electionID,
        voterAddress: voterCredentials.voterWallet.address,
        encryptedVote: encryptedVotes,
    }

    validateRecastingVotingTransaction(recastingVotingTransaction)

    return recastingVotingTransaction;
}

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
        const votesString = votesToString(votes);
        const buffer = new TextEncoder().encode(votesString);
        const encrypted = await subtle.encrypt(
            {
                name: "RSA-OAEP"
            },
            publicKey,
            buffer
        );

        return {
            hexString: '0x' + Buffer.from(encrypted).toString('hex')
        };
    } catch (error) {
        if (error instanceof Error) {
            throw new Error("Failed to encrypt votes: " + error.message);
        } else {
            throw new Error("Failed to encrypt votes due to an unknown error. Error: " + error);
        }
    }
}

/**
 * Decrypts a string of encrypted votes using RSA-OAEP with SHA-256.
 * @param {EncryptedVotes} encryptedVotes - Encrypted votes
 * @param {PrivateKeyDer} privateKeyHex - Election Private key in DER format
 * @returns {Array<Vote>} An array of votes
 * @throws {Error} if no valid encrypted data is provided or if any error occurs during the decryption process.
 */
export async function decryptVotes(encryptedVotes: EncryptedVotes, privateKeyHex: PrivateKeyDer): Promise<Array<Vote>> {

    if (!encryptedVotes.hexString || encryptedVotes.hexString.length <= 2 || !encryptedVotes.hexString.startsWith('0x')) {
        throw new Error("Decryption error: No valid encrypted data provided.");
    }

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
        return stringToVotes(votesString);
    } catch (error) {
        if (error instanceof Error) {
            throw new Error("Failed to decrypt votes: " + error.message);
        } else {
            throw new Error("Failed to decrypt votes due to an unknown error. Error: " + error);
        }

    }
}


/**
 * Helper function to convert an array of votes to string.
 * @param {Array<Vote>} votes - Array of votes to convert.
 * @returns {string} String representation of votes.
 */
function votesToString(votes: Array<Vote>): string {
    return votes.reduce((acc, vote) => acc + vote.value.toString(), '');
}

/**
 * Helper function to convert a string to an array of votes.
 * @param {string} votesString - String representation of votes.
 * @returns {Array<Vote>} Array of votes.
 * @throws {Error} if any character in the votesString is not a valid VoteOption.
 */
function stringToVotes(votesString: string): Array<Vote> {
    const votes = [...votesString].map(char => {
        const voteValue = parseInt(char);
        if (!Object.values(VoteOption).includes(voteValue)) {
            throw new Error(`Invalid vote option encountered: ${voteValue}`);
        }
        return { value: voteValue as VoteOption };
    });
    return votes;
}


/**
 * Converts a hex string into a Buffer. Removes '0x'-prefix is present
 * @param {string} hexString -  hex string to convert
 * @returns {Buffer} Buffer representing binary data
 */
function hexToBuffer(hexString: string): Buffer {
    if (hexString.startsWith('0x')) {
        hexString = hexString.substring(2);
    }
    return Buffer.from(hexString, 'hex');
}
