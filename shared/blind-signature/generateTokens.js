"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hexStringToBigInt = exports.isValidHex = exports.validateSignature = exports.validateR = exports.validateToken = exports.validateHexString = exports.unblindSignature = exports.verifyUnblindedSignature = exports.blindToken = exports.deriveElectionUnblindedToken = exports.deriveElectionR = exports.qrToTokenAndR = exports.concatTokenAndRForQR = exports.generateMasterTokenAndMasterR = void 0;
const ethers_1 = require("ethers");
const enc_base64_1 = __importDefault(require("crypto-js/enc-base64"));
const enc_hex_1 = __importDefault(require("crypto-js/enc-hex"));
const bigint_crypto_utils_1 = require("bigint-crypto-utils");
/*** Public Constants ***/
const Register = {
    e: BigInt("0x10001"),
    N: BigInt("0xb04da828580e20ca83f0de9c0c62a201bf5d4b3afa8131e6dbd56efcdbc43bf1c66f1e27b24631ee13cba9c5e783560db2f7aae59fd88c7d381fe10519f84329"),
    NbitLength: 512, // Bit length of N
};
/*** Main methods ***/
/**
 * Generates an unblinded master token and a master r
 * @returns An object containing the masterToken as Token and masterR as R objects.
 */
function generateMasterTokenAndMasterR() {
    const masterToken = { hexString: ethers_1.ethers.hexlify(ethers_1.ethers.randomBytes(32)), isMaster: true, isBlinded: false };
    const masterR = { hexString: ethers_1.ethers.hexlify(ethers_1.ethers.randomBytes(32)), isMaster: true };
    return {
        masterToken,
        masterR
    };
}
exports.generateMasterTokenAndMasterR = generateMasterTokenAndMasterR;
/**
 * Concatenates a token and r after encoding each to Base64 for QR code generation.
 * Each token is validated and then converted to Base64. The Base64-encoded
 * tokens are concatenated with a '|' delimiter.
 * @param token - The token to be encoded and concatenated.
 * @param masterR - The r to be encoded and concatenated.
 * @returns A concatenated Base64 string of the token and r.
 */
function concatTokenAndRForQR(token, r) {
    validateToken(token);
    validateR(r);
    if (token.isBlinded) {
        throw new Error("Blinded Tokens are not allowed for QR code Generation");
    }
    return `${hexStringToBase64(token, 66)}|${hexStringToBase64(r, 66)}`;
}
exports.concatTokenAndRForQR = concatTokenAndRForQR;
/**
 * Splits a concatenated Base64 string into token and r after decoding each from Base64.
 * The Base64-encoded tokens are split using the '|' delimiter.
 * @param concatenatedBase64 - The concatenated Base64 string to be split and decoded.
 * @returns An object containing the token and r.
 */
function qrToTokenAndR(concatenatedBase64, isMaster) {
    // Split the string using the '|' delimiter
    const [tokenBase64, rBase64] = concatenatedBase64.split('|');
    // Decode the Base64 strings into Token and r objects
    const token = { hexString: base64ToHexString(tokenBase64), isMaster: isMaster, isBlinded: false }; // All QR codes must store unblinded Tokens
    const r = { hexString: base64ToHexString(rBase64), isMaster: isMaster };
    return { token, r };
}
exports.qrToTokenAndR = qrToTokenAndR;
/**
 *
 * Derives deterministically an election-specific R from a master R and an unblinded election token.
 * It iteratively calculates R using the election ID, master R, and a nonce until finding an R that
 * leads to a blinded token starting with '0x1'.
 * @param electionID - The unique identifier of the election.
 * @param masterR - The master R used for deriving the election-specific R.
 * @param unblindedElectionToken - The unblinded, election-specific token associated, which must not be blinded or a master token.
 * @returns An R object representing the derived election-specific R.
 * @throws Error if invalid inputs are provided or if the input token is a master or already blinded token.
 */
function deriveElectionR(electionID, masterR, unblindedElectionToken) {
    validateR(masterR);
    validateToken(unblindedElectionToken);
    if (unblindedElectionToken.isMaster) {
        throw new Error("Master Token cannot be used for R Generation");
    }
    if (unblindedElectionToken.isBlinded) {
        throw new Error("Only unblinded Tokens can be used for R Generation");
    }
    if (!masterR.isMaster) {
        throw new Error("Only Master R can be used for R Generation");
    }
    let iterations = 0;
    let blindedToken;
    let nonce = 0n;
    // Initial calculation of electionR as bigint
    let electionRBig = hexStringToBigInt(ethers_1.ethers.sha256(ethers_1.ethers.toUtf8Bytes(`${electionID}|${masterR.hexString}|${0}`)));
    let electionR;
    do {
        iterations++;
        let gcd;
        // Recalculate electionR with an incremented nonce until a valid R, generating a 0x1 prefixed blinded token
        do {
            if (nonce > 0n) {
                electionRBig = hexStringToBigInt(ethers_1.ethers.sha256(ethers_1.ethers.toUtf8Bytes(`${electionID}|${masterR.hexString}|${nonce}`)));
            }
            nonce = nonce + 1n;
            electionRBig = electionRBig % Register.N;
            gcd = gcdBigInt(electionRBig, Register.N);
        } while (gcd !== 1n ||
            electionRBig >= Register.N ||
            electionRBig <= 1n);
        const rHex = electionRBig.toString(16).padStart(64, '0');
        electionR = { hexString: "0x" + rHex, isMaster: false };
        blindedToken = blindToken(unblindedElectionToken, electionR);
    } while (!blindedToken.hexString.startsWith('0x1')); // Ensure blinded token has a '0x1' prefix
    return electionR;
}
exports.deriveElectionR = deriveElectionR;
/**
 * Derives an election-specific, '0x0' prefixed unblinded token from a given master token.
 *
 * @param electionID - The unique identifier of the election.
 * @param masterToken - The master token used for derivation.
 * @returns A Token object representing the derived unblinded election-specific token.
 * @throws Error if the provided token is not a master token or blinded.
 */
function deriveElectionUnblindedToken(electionID, masterToken) {
    validateToken(masterToken);
    if (!masterToken.isMaster) {
        throw new Error("Only Master Token can be used to derive Election Token");
    }
    if (masterToken.isBlinded) {
        throw new Error("Only unblinded Master Token can be used to derive Election Token");
    }
    let nonce = 0;
    let tokenHexString;
    do {
        tokenHexString = ethers_1.ethers.sha256(ethers_1.ethers.toUtf8Bytes(`${electionID}|${masterToken.hexString}|${nonce}`));
        nonce++;
    } while (!tokenHexString.startsWith('0x0')); // Ensure token has a '0x0' prefix
    return { hexString: tokenHexString, isMaster: false, isBlinded: false };
}
exports.deriveElectionUnblindedToken = deriveElectionUnblindedToken;
/**
 * Performs the blinding of an unblinded token using a given R.
 *
 * @param unblindedToken - The unblinded token to be blinded.
 * @param r - The r used in the blinding process.
 * @returns A Token object representing the blinded token.
 * @throws Error if the provided token is already blinded.
 */
function blindToken(unblindedToken, r) {
    validateToken(unblindedToken);
    validateR(r);
    if (unblindedToken.isBlinded) {
        throw new Error("Only unblinded Tokens can be blinded");
    }
    if (unblindedToken.isMaster) {
        throw new Error("Not allowed not blind a Master Token");
    }
    if (r.isMaster) {
        throw new Error("Not allowed to blind with Master R");
    }
    // Convert hex strings to BigInts for calculation
    const unblindedTokenBig = hexStringToBigInt(unblindedToken.hexString);
    const rBig = hexStringToBigInt(r.hexString);
    // Perform blinding: (Token_unblinded * r^e) mod N
    const blindedHexBig = (unblindedTokenBig * rBig ** Register.e) % Register.N;
    const hexLength = Register.NbitLength / 4; // Convert bit length to hex length
    const blindedToken = {
        hexString: '0x' + blindedHexBig.toString(16).padStart(hexLength, '0'),
        isMaster: unblindedToken.isMaster,
        isBlinded: true
    };
    validateToken(blindedToken);
    return blindedToken;
}
exports.blindToken = blindToken;
/**
 * Verifies whether an unblinded signature corresponds to a given unblinded token.
 * @param unblindedSignature - The signature object after unblinding.
 * @param unblindedToken - The unblinded token object that was signed
 * @returns Boolean - Returns true if the unblinded signature corresponds to the unblinded token, false otherwise.
 *
 * @throws Error if the signature is blinded, if the token is a master token, or if the token is blinded.
 */
function verifyUnblindedSignature(unblindedSignature, unblindedToken) {
    validateSignature(unblindedSignature);
    validateToken(unblindedToken);
    if (unblindedSignature.isBlinded) {
        throw Error("Must provide unblinded Signature");
    }
    if (unblindedToken.isMaster) {
        throw Error("Unblinded Token must not be master Token");
    }
    if (unblindedToken.isBlinded) {
        throw Error("Unblinded Token must not be blinded");
    }
    const unblindedSignatureBig = hexStringToBigInt(unblindedSignature.hexString);
    const unblindedTokenBig = hexStringToBigInt(unblindedToken.hexString);
    const expectedTokenBig = unblindedSignatureBig ** Register.e % Register.N;
    const isEqual = expectedTokenBig === unblindedTokenBig;
    return isEqual;
}
exports.verifyUnblindedSignature = verifyUnblindedSignature;
/**
 * Unblinds a blinded signature using a given R.
 * @param signature - The blinded signature to be unblinded.
 * @param r - The r used in the unblinding process.
 * @returns A Signature object representing the unblinded signature.
 * @throws Error if the provided signature is not blinded.
 */
function unblindSignature(signature, r) {
    validateSignature(signature);
    validateR(r);
    if (!signature.isBlinded) {
        throw new Error("Only blinded Signatures can be unblinded");
    }
    if (r.isMaster) {
        throw new Error("Not allowed to unblind with Master R");
    }
    // Convert hex strings to BigInts for calculation
    const rBig = hexStringToBigInt(r.hexString);
    const signatureBig = hexStringToBigInt(signature.hexString);
    // Perform unblinding: (Signature_blinded * r^-1) mod N
    const rInverse = (0, bigint_crypto_utils_1.modInv)(rBig, Register.N);
    const unblindedSigBig = (signatureBig * rInverse) % Register.N;
    const hexLength = Register.NbitLength / 4; // Convert bit length to hex length
    const unblindedSignature = { hexString: '0x' + unblindedSigBig.toString(16).padStart(hexLength, '0'), isBlinded: false };
    validateSignature(unblindedSignature);
    return unblindedSignature;
}
exports.unblindSignature = unblindSignature;
/*** Helpers ***/
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
        expectedLength = (Register.NbitLength / 4) + 2; // Adjust length for blinded tokens: Convert bit length to hex length and add 2 for '0x' prefix.
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
    const expectedLength = (Register.NbitLength / 4) + 2; // length for signature: Convert bit length to hex length and add 2 for '0x' prefix.
    validateHexString(signature, expectedLength);
}
exports.validateSignature = validateSignature;
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
/**
 * Computes the GCD of two bigint numbers, using Euclidean algorithm.
 * @param a - The first bigint number.
 * @param b - The second bigint number.
 * @returns The GCD of a and b.
 */
function gcdBigInt(a, b) {
    if (b === 0n)
        return a;
    return gcdBigInt(b, a % b);
}
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
