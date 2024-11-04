
import Hex from 'crypto-js/enc-hex';
import { ElectionCredentials, EncryptedVotes, EthSignature, R, RSAParams, RecastingVotingTransaction, Signature, Token, Vote, VoteOption, VotingTransaction } from '../types/types';
import Base64 from 'crypto-js/enc-base64';
import { ethers, verifyTypedData } from 'ethers';
import * as crypto from 'crypto';
import { RSA_BIT_LENGTH, PREFIX_BLINDED_TOKEN, PREFIX_UNBLINDED_TOKEN } from './constants';
import { modPow } from 'bigint-crypto-utils';
import { SignatureData } from '@gelatonetwork/relay-sdk';
import { gelatoRelayDomain, gelatoRelayTypes } from '../config';

/**
 * Validates a hexadecimal string.
 * @param hexStringObject - An object containing a hexadecimal string to be validated.
 * @param expectedLength - The expected length of the hexadecimal string.
 * @throws Will throw an error if the hexadecimal string is invalid or of incorrect length.
 */
export function validateHexString(hexStringObject: { hexString: string }, expectedLength: number, shouldBeLowerCase: boolean = false): void {

    if (hexStringObject.hexString.length !== expectedLength) {
        throw new Error(`Invalid token length. Expected length: ${expectedLength}, but got: ${hexStringObject.hexString.length}. Token: ${hexStringObject.hexString}`);
    }

    if (!isValidHex(hexStringObject.hexString, shouldBeLowerCase)) {
        throw new Error(`Invalid token format. Token: ${hexStringObject.hexString}`);
    }
}


/**
 * Checks if a string is a valid non-null, non-zero hexadecimal format.
 * A null, empty, or zero value hex string is not allowed.
 * @param str - The string to be checked.
 * @param shouldBeLowerCase - If true, checks if the string is in lowercase.
 * @returns True if the string is a valid non-zero hexadecimal, false otherwise.
 */
export function isValidHex(str: string, shouldBeLowerCase: boolean = false): boolean {
    if (!str || str.length < 3) {
        return false;
    }

    str = str.startsWith('0x')
        ? str.substring(2)
        : str

    const regexp = /^[0-9a-fA-F]+$/;

    if (!regexp.test(str)) {
        return false;
    }

    if (shouldBeLowerCase && str !== str.toLowerCase()) {
        return false;
    }

    if (BigInt(`0x${str}`) === BigInt(0)) {
        return false;
    }

    return true;
}

/**
 * Validates an election ID.
 * @param electionID - The election ID to be checked.
 * @throws Will throw an error if election ID is a negative number or bigger than 1,000,000.
 */
export function validateElectionID(electionID: number) {
    if (!Number.isInteger(electionID)) {
        throw new Error(`Invalid election ID: ${electionID}. Must be an integer.`);
    }

    if (electionID < 0 || electionID > 1000000) {
        throw new Error("Election ID out of range")
    }
}


/**
 * Converts a hexadecimal string to a Base64 string.
 *
 * @param hexStringObject - An object containing a hexadecimal string to be converted.
 * @returns The Base64 string representation of the hexadecimal string.
 */
export function hexStringToBase64(hexStringObject: { hexString: string }, expectedHexLength: number): string {
    validateHexString(hexStringObject, expectedHexLength);
    const wordArray = Hex.parse(hexStringObject.hexString.substring(2));
    return Base64.stringify(wordArray);
}


/**
 * Validates the provided token based on its properties.
 *
 * @param {Token} token - The token to validate.
 * @param {boolean} [validatePrefix=true] - Whether to validate the token's prefix. Default is true.
 * @throws {Error} If the token is invalid or its properties are inconsistent.
 */
export function validateToken(token: Token, validatePrefix: boolean = true): void {
    if (token.isBlinded && token.isMaster) {
        throw new Error("Master token must not be blinded");
    }

    let expectedLength = 66; // Default length for unblinded tokens (SHA-256 Output)
    if (token.isBlinded) {
        expectedLength = (RSA_BIT_LENGTH / 4) + 2; // Adjust length for blinded tokens: Convert bit length to hex length and add 2 for '0x' prefix.
    }

    validateHexString(token, expectedLength, true);

    // Check if tokenBig is within range
    const tokenBig = hexStringToBigInt(token.hexString);
    if (tokenBig <= 2n) {
        throw new Error("Token value is too low");
    }

    const upperBound = (1n << BigInt(RSA_BIT_LENGTH)) - 1n;
    if (tokenBig >= upperBound) {
        throw new Error("Token value is too high");
    }

    // Prefix is only for election Token (blinded & unblided) checked
    if (!token.isMaster && validatePrefix) {
        if (token.isBlinded && !token.hexString.toLowerCase().startsWith(PREFIX_BLINDED_TOKEN.toLowerCase())) {
            throw new Error(`Blinded Tokens must be ${PREFIX_BLINDED_TOKEN.toLowerCase()} prefixed`);
        } else if (!token.isBlinded && !token.hexString.toLowerCase().startsWith(PREFIX_UNBLINDED_TOKEN.toLowerCase())) {
            throw new Error(`Unblinded Tokens must be ${PREFIX_UNBLINDED_TOKEN.toLowerCase()} prefixed`);
        }
    }

}

/**
 * Validates RSA parameters to ensure they are secure.
 * @param rsaParams - The RSAParams object to be validated.
 * @throws Will throw an error if the RSA parameters are insecure.
 */
export function validateRSAParams(rsaParams: RSAParams): void {

    // Check if the bit length is less than 2048 bits
    if (rsaParams.NbitLength < RSA_BIT_LENGTH) {
        throw new Error("RSA bit length must be at least 2048 bits");
    }

    // Check if 'e' is within the typical range
    if (rsaParams.e !== undefined && (rsaParams.e < 3n || rsaParams.e % 2n === 0n)) {
        throw new Error("RSA exponent 'e' must be an odd number greater than 2");
    }

    // Check if NbitLength matches the real bit length of N
    const actualBitLength = getBitLength(rsaParams.N);
    if (rsaParams.NbitLength !== actualBitLength) {
        throw new Error("NbitLength does not match the actual bit length of N");
    }

    if (rsaParams.D !== undefined) {
        // D should be at least half the bit length of N
        const minDValue = 2n ** BigInt(rsaParams.NbitLength / 2);
        if (rsaParams.D < minDValue) {
            throw new Error("RSA private exponent 'D' is too small");
        }
    }

}


/**
 * Validates an R object.
 * @param r - The R object to be validated.
 * @throws Will throw an error if the R object is invalid or of incorrect length.
 */
export function validateR(r: R): void {
    const expectedLength = 66; // Default length sha 256-output
    validateHexString(r, expectedLength, true);

    const rBig = hexStringToBigInt(r.hexString);

    // Check lower bound
    if (rBig <= 2n) {
        throw new Error("R value is too low");
    }

}


/**
 * Validates an Signature.
 * @param signature - The Signature object to be validated.
 * @throws Will throw an error if the Signature object is invalid or of incorrect length.
 */
export function validateSignature(signature: Signature): void {
    const expectedLength = (RSA_BIT_LENGTH / 4) + 2; // length for signature: Convert bit length to hex length and add 2 for '0x' prefix.
    validateHexString(signature, expectedLength, true);

    // Check if tokenBig is within range
    const signatureBig = hexStringToBigInt(signature.hexString);
    if (signatureBig <= 2n) {
        throw new Error("Signature value is too low");
    }

    const upperBound = (1n << BigInt(RSA_BIT_LENGTH)) - 1n;
    if (signatureBig >= upperBound) {
        throw new Error("Signature value is too high");
    }

}

/**
 * Validates an EIP-191 compliant Ethereum signature.
 * @param ethSignature - The EthSignature to be validated.
 * @throws Will throw an error if the EthSignature object is invalid or of incorrect length.
 */
export function validateEthSignature(ethSignature: EthSignature): void {

    const expectedLength = 132; // Ethereum signature length is 65 bytes, plus 2 for '0x' prefix
    validateHexString(ethSignature, expectedLength);
    try {
        ethers.Signature.from(ethSignature.hexString);
    } catch (error) {
        throw new Error("Invalid Ethereum signature");
    }
}

/**
 * Validates an EncryptedVotes object.
 * @param encryptedVotes - The EncryptedVotes object to be validated.
 * @throws Will throw an error if the EncryptedVotes object is invalid or of incorrect length.
 */
export function validateEncryptedVotes(encryptedVotes: EncryptedVotes): void {
    validateHexString(encryptedVotes, (RSA_BIT_LENGTH / 4) + 2);
}

/**
 * Validates an array of votes.
 * Converts the votes to a string and checks the byte length of the encoded string
 * to ensure it is within the acceptable range for RSA-OAEP with SHA-256 encryption.
 *
 * @param {Array<Vote>} votes - The array of votes to be validated.
 * @throws {Error} If the message length is outside the acceptable range.
 */
export function validateVotes(votes: Array<Vote>): void {
    const votesString: string = votesToString(votes);
    const buffer = new TextEncoder().encode(votesString);

    // Range check
    const minMessageLength = 2;
    // Maximum message length for RSA-OAEP with SHA-256: RSA Key Byte-Size - 2* SHA256 output - 2 OAEP padding overhead
    const maxMessageLength = Math.floor(RSA_BIT_LENGTH / 8) - 2 * (256 / 8) - 2;
    if (buffer.length > maxMessageLength) {
        throw new Error(`Message too long. Maximum length is ${maxMessageLength} bytes, but got ${buffer.length} bytes.`);
    }
    if (buffer.length < minMessageLength) {
        throw new Error(`Message too short. Minimum length is ${minMessageLength} bytes, but got ${buffer.length} bytes.`);
    }
}


/**
 * Validates a voting transaction.
 * Ensures that the voting transaction does not include a master token, a blinded token, or a blinded signature.
 * @param {VotingTransaction} votingTransaction - The voting transaction to validate.
 * @throws {Error} Will throw an error if any validation check fails.
 */
export function validateVotingTransaction(votingTransaction: VotingTransaction): void {

    if (!votingTransaction.unblindedElectionToken || !votingTransaction.unblindedSignature) {
        throw new Error("Invalid voting transaction: missing required properties");
    }

    validateElectionID(votingTransaction.electionID)
    validateEthAddress(votingTransaction.voterAddress)
    validateEncryptedVotes(votingTransaction.encryptedVote)
    validateToken(votingTransaction.unblindedElectionToken)
    validateSignature(votingTransaction.unblindedSignature)

    if (votingTransaction.unblindedElectionToken.isMaster) {
        throw new Error("Voting transaction must not include a Master Token.");

    }
    if (votingTransaction.unblindedElectionToken.isBlinded) {
        throw new Error("Voting transaction must not include a blinded Token");

    }

    if (votingTransaction.unblindedSignature.isBlinded) {
        throw new Error("Voting transaction must not include a blinded Signature");

    }

    if (votingTransaction.svsSignature) {
        validateEthSignature(votingTransaction.svsSignature)
    }
}

/**
 * Validates a recasting voting transaction.
 * Ensures that the recasting voting transaction has the required fields.
 * @param {RecastingVotingTransaction} recastingTransaction - The recasting voting transaction to validate.
 * @throws {Error} Will throw an error if any validation check fails.
 */
export function validateRecastingVotingTransaction(recastingTransaction: RecastingVotingTransaction): void {
    validateElectionID(recastingTransaction.electionID)
    validateEncryptedVotes(recastingTransaction.encryptedVote);
    validateEthAddress(recastingTransaction.voterAddress);
}

/**
 * Validates an Ethereum address.
 * @param address - The Ethereum address to be validated.
 * @throws Will throw an error if the address is invalid.
 */
export function validateEthAddress(address: string): void {
    if (!ethers.isAddress(address)) {
        throw new Error("Invalid Ethereum address provided.");
    }
}

/**
 * Normalizes and validates an Ethereum address.
 * 
 * @param address - The Ethereum address to process.
 * @returns The normalized address in checksum format.
 * @throws If the address is invalid or fails checksum validation.
 */
export function normalizeEthAddress(address: string): string {
    validateEthAddress(address)
    return ethers.getAddress(address);

}

/**
 * Normalizes a hexadecimal string by removing the '0x' prefix,
 * converting to lowercase, and removing leading zeros.
 * Throws an error if the string represents zero.
 * 
 * @param hexString - The hexadecimal string to normalize.
 * @returns The normalized hexadecimal string.
 * @throws Error if the resulting string is empty after normalization.
 */
export function normalizeHexString(hexString: string): string {
    isValidHex(hexString)
    // Remove '0x' prefix if present and convert to lowercase
    const cleanHex = hexString.toLowerCase().replace(/^0x/, '');

    isValidHex(cleanHex, true);

    const bigIntValue = BigInt('0x' + cleanHex);

    let normalized = bigIntValue.toString(16);

    if (normalized === '0') {
        throw new Error('Hexadecimal string represents zero');
    }

    return normalized;
}


/**
* Converts a hexadecimal string to a bigint.
* @param hexString - The hexadecimal string to convert.
* @returns The bigint representation of the hexadecimal string.
*/
export function hexStringToBigInt(hexString: string): bigint {
    // Ensure the hexString is 0x prefixed
    if (!hexString.startsWith('0x')) {
        hexString = '0x' + hexString;
    }

    // Convert the hex string to a bigint
    const messageBigInt = BigInt(hexString);
    return messageBigInt;
}

/**
 * Converts a Base64-encoded string to a hexadecimal string with "0x" prefix.
 * This function handles the conversion Token, R and Signature types.
 *
 * @param base64String - The Base64 string to be converted.
 * @returns A '0x' prefixed hexadecimal string representation of the Base64 input.
 */
export function base64ToHexString(base64String: string): string {
    const wordArray = Base64.parse(base64String);
    const hexStringWithPrefix = "0x" + Hex.stringify(wordArray);
    return hexStringWithPrefix;
}

/**
 * Validates the integrity and format of ElectionCredentials.
 * @param credentials - The ElectionCredentials object to be validated.
 * @throws Will throw an error if the credentials object is invalid.
 */
export function validateCredentials(credentials: ElectionCredentials): void {
    validateSignature(credentials.unblindedSignature)
    validateToken(credentials.unblindedElectionToken)
    validateElectionID(credentials.electionID)

    const voterWalletPrivKey = credentials.voterWallet.privateKey
    validateHexString({ hexString: voterWalletPrivKey }, 66)
    validateEthAddress(credentials.voterWallet.address)

    if (credentials.unblindedSignature.isBlinded) {
        throw new Error("Signature must be unblinded.");
    }
    if (credentials.unblindedElectionToken.isBlinded) {
        throw new Error("Election token must be unblinded.");
    }
    if (credentials.unblindedElectionToken.isMaster) {
        throw new Error("Election token must not be a master token.");
    }
}


/**
 * Signs a blinded token using the provided RSA parameters.
 *
 * @param {Token} token - The blinded token to be signed.
 * @param {RSAParams} rsaParams - The RSA parameters, including the private exponent.
 * @returns {Signature} The signature of the blinded token.
 * @throws {Error} If the token is not blinded, if it is a master token, if the private exponent is missing,
 *                 if the token is invalid, if the RSA parameters are invalid, or if the token is out of the valid range.
 */
export function signToken(token: Token, rsaParams: RSAParams): Signature {
    if (!token.isBlinded) { throw new Error("Only blinded Tokens shall be signed"); }
    if (token.isMaster) { throw new Error("Master Tokens shall not be signed"); }
    if (!rsaParams.D) { throw new Error("Private exponent is missing") }
    validateRSAParams(rsaParams)
    validateToken(token);

    const tokenBig = hexStringToBigInt(token.hexString);
    if (tokenBig <= 2n || tokenBig >= rsaParams.N - 1n) {
        throw new Error("Token is out of valid range");
    }

    const signatureBig = modPow(tokenBig, rsaParams.D, rsaParams.N);  // tokenBig ** rsaParams.D % rsaParams.N;

    // Calculate  hex length from N if not provided
    const signatureHex = '0x' + signatureBig.toString(16).padStart(rsaParams.NbitLength / 4, '0');
    const blindedSignature = { hexString: signatureHex, isBlinded: true };
    validateSignature(blindedSignature);

    return blindedSignature;
}

/**
 * Returns the bit length of a BigInt value.
 * @param bigIntValue - The BigInt value to get the bit length of.
 * @returns The bit length of the BigInt value.
 */
export function getBitLength(bigIntValue: BigInt) {
    return bigIntValue.toString(2).length;
}

/**
 * Returns the appropriate SubtleCrypto instance based on the environment (browser or Node.js).
 * @returns A SubtleCrypto instance.
 */
export function getSubtleCrypto(): SubtleCrypto | crypto.webcrypto.SubtleCrypto {
    if (typeof window !== 'undefined' && typeof window.crypto !== 'undefined') {
        return window.crypto.subtle;
    } else {
        return crypto.webcrypto.subtle;
    }
}

/**
 * Helper function to convert an array of votes to string.
 * @param {Array<Vote>} votes - Array of votes to convert.
 * @returns {string} String representation of votes.
 */
export function votesToString(votes: Array<Vote>): string {
    return votes.reduce((acc, vote) => acc + vote.value.toString(), '');
}

/**
 * Helper function to convert a string to an array of votes.
 * @param {string} votesString - String representation of votes.
 * @returns {Array<Vote>} Array of votes.
 * @throws {Error} if any character in the votesString is not a valid VoteOption.
 */
export function stringToVotes(votesString: string): Array<Vote> {
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
export function hexToBuffer(hexString: string): Buffer {
    if (hexString.startsWith('0x')) {
        hexString = hexString.substring(2);
    }
    return Buffer.from(hexString, 'hex');
}

/**
 * Validates a Gelato ERC2771 signature for sponsored calls.
 * @param signatureData - The signature data containing the struct and signature.
 * @throws Will throw an error if the signature data is invalid.
 */
export function validateGelatoSignature(signatureData: SignatureData) {
    try {

        const signer = signatureData.struct.user;
        const signature: EthSignature = { hexString: signatureData.signature };
        validateEthAddress(signer);
        validateEthSignature(signature);

        const recoveredAddress = verifyTypedData(
            gelatoRelayDomain,
            gelatoRelayTypes,
            signatureData.struct,
            signatureData.signature
        );

        const isValid = recoveredAddress.toLowerCase() === signer.toLowerCase();

        if (!isValid) {
            throw new Error(`Signature signer mismatch. Expected: ${signer}, got: ${recoveredAddress}`);
        }

    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Gelato signature validation failed: ${error.message}`);
        }
        throw new Error('Gelato signature validation failed with unknown error');
    }
}