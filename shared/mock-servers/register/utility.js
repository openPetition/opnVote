"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidHex = exports.hexStringToBigInt = exports.signToken = void 0;
const validation_1 = require("./validation");
const config_1 = require("./config");
function signToken(token) {
    if (!token.isBlinded) {
        throw new Error("Only blinded Tokens shall be signed");
    }
    if (token.isMaster) {
        throw new Error("Master Tokens shall not be signed");
    }
    (0, validation_1.validateToken)(token);
    const tokenBig = hexStringToBigInt(token.hexString);
    const signatureBig = powermod(tokenBig, config_1.TestRegister.D, config_1.TestRegister.N); // tokenBig ** TestRegister.D % TestRegister.N;
    const hexLength = config_1.TestRegister.NbitLength / 4; // Convert bit length to hex length
    const signatureHex = '0x' + signatureBig.toString(16).padStart(hexLength, '0');
    const blindedSignature = { hexString: signatureHex, isBlinded: true };
    (0, validation_1.validateSignature)(blindedSignature);
    return blindedSignature;
}
exports.signToken = signToken;
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
