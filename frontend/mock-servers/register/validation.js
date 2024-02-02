"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateHexString = exports.validateSignature = exports.validateToken = void 0;
const utility_1 = require("./utility");
const config_1 = require("./config");
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
        expectedLength = (config_1.TestRegister.NbitLength / 4) + 2; // Adjust length for blinded tokens: Convert bit length to hex length and add 2 for '0x' prefix.
    }
    validateHexString(token, expectedLength);
}
exports.validateToken = validateToken;
function validateSignature(signature) {
    const expectedLength = (config_1.TestRegister.NbitLength / 4) + 2; // length for signature: Convert bit length to hex length and add 2 for '0x' prefix.
    validateHexString(signature, expectedLength);
}
exports.validateSignature = validateSignature;
/**
 * Validates a hexadecimal string.
 * @param hexStringObject - An object containing a hexadecimal string to be validated.
 * @param expectedLength - The expected length of the hexadecimal string.
 * @throws Will throw an error if the hexadecimal string is invalid or of incorrect length.
 */
function validateHexString(hexStringObject, expectedLength) {
    if (hexStringObject.hexString.length !== expectedLength || !(0, utility_1.isValidHex)(hexStringObject.hexString)) {
        throw new Error(`Invalid token format or length. Expected length: ${expectedLength} Token: ${hexStringObject.hexString}`);
    }
}
exports.validateHexString = validateHexString;
