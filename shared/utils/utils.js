"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = exports.validateCredentials = exports.base64ToHexString = exports.hexStringToBigInt = exports.validateSignature = exports.validateR = exports.validateToken = exports.hexStringToBase64 = exports.isValidHex = exports.validateHexString = void 0;
const enc_hex_1 = __importDefault(require("crypto-js/enc-hex"));
const enc_base64_1 = __importDefault(require("crypto-js/enc-base64"));
const config_1 = require("../config");
/**
 * Validates a hexadecimal string.
 * @param hexStringObject - An object containing a hexadecimal string to be validated.
 * @param expectedLength - The expected length of the hexadecimal string.
 * @throws Will throw an error if the hexadecimal string is invalid or of incorrect length.
 */
function validateHexString(hexStringObject, expectedLength) {
    if (hexStringObject.hexString.length !== expectedLength || !isValidHex(hexStringObject.hexString)) {
        throw new Error(`Invalid token format or length. Expected length: ${expectedLength} Token: ${hexStringObject.hexString}`);
    }
}
exports.validateHexString = validateHexString;
/**
 * Checks if a string is a valid hexadecimal format.
 * @param str - The string to be checked.
 * @returns True if the string is a valid hexadecimal, false otherwise.
 */
function isValidHex(str) {
    if (str.length < 3) {
        return false;
    }
    str = str.startsWith('0x')
        ? str.substring(2)
        : str;
    const regexp = /^[0-9a-fA-F]+$/;
    return regexp.test(str);
}
exports.isValidHex = isValidHex;
/**
 * Converts a hexadecimal string to a Base64 string.
 *
 * @param hexStringObject - An object containing a hexadecimal string to be converted.
 * @returns The Base64 string representation of the hexadecimal string.
 */
function hexStringToBase64(hexStringObject, expectedHexLength) {
    validateHexString(hexStringObject, expectedHexLength);
    const wordArray = enc_hex_1.default.parse(hexStringObject.hexString.substring(2));
    return enc_base64_1.default.stringify(wordArray);
}
exports.hexStringToBase64 = hexStringToBase64;
/**
 * Validates a token object.
 * @param token - The token object to be validated.
 * @throws Will throw an error if the token object is invalid.
 */
function validateToken(token) {
    if (token.isBlinded && token.isMaster) {
        throw new Error("Master token must not be blinded");
    }
    let expectedLength = 66; // Default length for unblinded tokens (SHA-256 Output)
    if (token.isBlinded) {
        expectedLength = (config_1.Register.NbitLength / 4) + 2; // Adjust length for blinded tokens: Convert bit length to hex length and add 2 for '0x' prefix.
    }
    validateHexString(token, expectedLength);
}
exports.validateToken = validateToken;
/**
 * Validates an R object.
 * @param r - The R object to be validated.
 * @throws Will throw an error if the R object is invalid or of incorrect length.
 */
function validateR(r) {
    const expectedLength = 66; // Default length for R (SHA-256 output)
    validateHexString(r, expectedLength);
}
exports.validateR = validateR;
/**
 * Validates an Signature.
 * @param signature - The Signature object to be validated.
 * @throws Will throw an error if the Signature object is invalid or of incorrect length.
 */
function validateSignature(signature) {
    const expectedLength = (config_1.Register.NbitLength / 4) + 2; // length for signature: Convert bit length to hex length and add 2 for '0x' prefix.
    validateHexString(signature, expectedLength);
}
exports.validateSignature = validateSignature;
/**
* Converts a hexadecimal string to a bigint.
* @param hexString - The hexadecimal string to convert.
* @returns The bigint representation of the hexadecimal string.
*/
function hexStringToBigInt(hexString) {
    // Ensure the hexString is 0x prefixed
    if (!hexString.startsWith('0x')) {
        hexString = '0x' + hexString;
    }
    // Convert the hex string to a bigint
    const messageBigInt = BigInt(hexString);
    return messageBigInt;
}
exports.hexStringToBigInt = hexStringToBigInt;
/**
 * Converts a Base64-encoded string to a hexadecimal string with "0x" prefix.
 * This function handles the conversion Token, R and Signature types.
 *
 * @param base64String - The Base64 string to be converted.
 * @returns A '0x' prefixed hexadecimal string representation of the Base64 input.
 */
function base64ToHexString(base64String) {
    const wordArray = enc_base64_1.default.parse(base64String);
    const hexStringWithPrefix = "0x" + enc_hex_1.default.stringify(wordArray);
    return hexStringWithPrefix;
}
exports.base64ToHexString = base64ToHexString;
/**
 * Validates the integrity and format of ElectionCredentials.
 * @param credentials - The ElectionCredentials object to be validated.
 * @throws Will throw an error if the credentials object is invalid.
 */
function validateCredentials(credentials) {
    validateToken(credentials.unblindedElectionToken);
    validateSignature(credentials.unblindedSignature);
    const voterWalletPrivKey = credentials.voterWallet.privateKey;
    validateHexString({ hexString: voterWalletPrivKey }, 66);
    if (credentials.unblindedSignature.isBlinded) {
        throw new Error("Signature must be unblinded.");
    }
    if (credentials.unblindedElectionToken.isBlinded) {
        throw new Error("Election token must be unblinded.");
    }
    if (credentials.unblindedElectionToken.isMaster) {
        throw new Error("Election token must not be a master token.");
    }
    if (credentials.electionID < 0) {
        throw new Error("Election ID must be a non-negative number.");
    }
}
exports.validateCredentials = validateCredentials;
//Helper function to sign a token
//Not for production use
function signToken(token) {
    if (!token.isBlinded) {
        throw new Error("Only blinded Tokens shall be signed");
    }
    if (token.isMaster) {
        throw new Error("Master Tokens shall not be signed");
    }
    validateToken(token);
    const tokenBig = hexStringToBigInt(token.hexString);
    const signatureBig = powermod(tokenBig, config_1.TestRegister.D, config_1.TestRegister.N); // tokenBig ** TestRegister.D % TestRegister.N;
    const hexLength = config_1.TestRegister.NbitLength / 4; // Convert bit length to hex length
    const signatureHex = '0x' + signatureBig.toString(16).padStart(hexLength, '0');
    const blindedSignature = { hexString: signatureHex, isBlinded: true };
    validateSignature(blindedSignature);
    return blindedSignature;
}
exports.signToken = signToken;
// Helper function calculation modpow
// Not for production use
function powermod(base, exp, p) {
    var result = 1n;
    while (exp !== 0n) {
        if (exp % 2n === 1n)
            result = result * base % p;
        base = base * base % p;
        exp >>= 1n;
    }
    return result;
}
