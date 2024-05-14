
import * as crypto from 'crypto';
import { ElectionCredentials, EncryptedVotes, PrivateKeyDer, PublicKeyDer, Signature, Vote, VoteOption, VotingTransaction, } from "../types/types";
import { validateEncryptedVotes, validateEthAddress, validateSignature, validateToken, validateVotingTransaction } from '../utils/utils';

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
 * @param {Signature} svsSignature - Unblinded SVS signature to be added to the voting transaction
 * @returns {VotingTransaction} Updated voting transaction with SVS signature
 * @throws {Error} if any validation (Signature, EncryptedVotes, Token, Signature, ...) fails
 */
export function addSVSSignatureToVotingTransaction(votingTransaction: VotingTransaction, svsSignature: Signature): VotingTransaction {

    if (votingTransaction.svsSignature) {
        throw new Error("Voting Transaction already contains SVS Signature");
    }

    if (svsSignature.isBlinded) {
        throw new Error("SVS Signature must be unblinded");
    }


    validateVotingTransaction(votingTransaction)
    validateSignature(svsSignature)

    return {
        ...votingTransaction,
        svsSignature: svsSignature
    }

}

/**
 * Encrypts an array of votes using RSA-OAEP with SHA-256 as hash function.
 * @param {Array<Vote>} votes - Array of votes to encrypt
 * @param {PublicKeyDer} publicKeyHex - Election Public key in DER format
 * @returns {EncryptedVotes} Encrypted votes
 * @throws {Error} if no votes are provided or if any error occurs during the encryption process
 */
export function encryptVotes(votes: Array<Vote>, publicKeyHex: PublicKeyDer): EncryptedVotes {
    if (votes.length === 0) {
        throw new Error("Encryption error: No votes provided.");
    }
    try {
        const publicKeyBuffer = hexToBuffer(publicKeyHex);
        const publicKeyObject = crypto.createPublicKey({ key: publicKeyBuffer, format: 'der', type: 'spki' });

        const votesString = votesToString(votes);
        const buffer = Buffer.from(votesString, 'utf8');
        const encrypted = crypto.publicEncrypt(
            {
                key: publicKeyObject,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256",
            },
            buffer
        );

        return {
            hexString: '0x' + encrypted.toString('hex')
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
export function decryptVotes(encryptedVotes: EncryptedVotes, privateKeyHex: PrivateKeyDer): Array<Vote> {

    if (!encryptedVotes.hexString || encryptedVotes.hexString.length <= 2 || !encryptedVotes.hexString.startsWith('0x')) {
        throw new Error("Decryption error: No valid encrypted data provided.");
    }

    try {
        const privateKeyBuffer = hexToBuffer(privateKeyHex);
        const privateKeyObject = crypto.createPrivateKey({ key: privateKeyBuffer, format: 'der', type: 'pkcs8' });
        const encryptedBuf = hexToBuffer(encryptedVotes.hexString)
        const decrypted = crypto.privateDecrypt(
            {
                key: privateKeyObject,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256",
            },
            encryptedBuf
        );
        const votesString = decrypted.toString('utf8');
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