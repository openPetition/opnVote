import { ethers } from "ethers";
import { modInv, modPow } from 'bigint-crypto-utils';
import { Token, R, Signature, RSAParams } from "../types/types";
import { base64ToHexString, hexStringToBase64, hexStringToBigInt, validateElectionID, validateR, validateRSAParams, validateSignature, validateToken } from "../utils/utils";
import { PREFIX_BLINDED_TOKEN, PREFIX_UNBLINDED_TOKEN } from "../utils/constants";
import { shake256 } from 'js-sha3';



/*** Main methods ***/


/**
 * Generates an unblinded master token and a master r.
 * @returns An object containing the masterToken as Token and masterR as R objects.
 */
export function generateMasterTokenAndMasterR(): { masterToken: Token, masterR: R } {
    const masterToken: Token = { hexString: ethers.hexlify(ethers.randomBytes(32)), isMaster: true, isBlinded: false };
    const masterR: R = { hexString: ethers.hexlify(ethers.randomBytes(32)), isMaster: true };
    return {
        masterToken,
        masterR
    };
}

/**
 * Concatenates a token and r after encoding each to Base64 for QR code generation.
 * Each token is validated and then converted to Base64. The Base64-encoded
 * tokens are concatenated with a '|' delimiter.
 * @param token - The token to be encoded and concatenated.
 * @param masterR - The r to be encoded and concatenated.
 * @returns A concatenated Base64 string of the token and r.
 */
export function concatTokenAndRForQR(token: Token, r: R): string {
    validateToken(token);
    validateR(r);

    if (token.isBlinded) {
        throw new Error("Blinded Tokens are not allowed for QR code Generation");
    }

    return `${hexStringToBase64(token, 66)}|${hexStringToBase64(r, 66)}`;
}


/**
 * Splits a concatenated Base64 string into token and r after decoding each from Base64.
 * The Base64-encoded tokens are split using the '|' delimiter.
 * @param concatenatedBase64 - The concatenated Base64 string to be split and decoded.
 * @returns An object containing the token and r.
 */
export function qrToTokenAndR(concatenatedBase64: string, isMaster: Boolean): { token: Token, r: R } {
    // Split the string using the '|' delimiter
    const [tokenBase64, rBase64] = concatenatedBase64.split('|');

    // Decode the Base64 strings into Token and r objects
    const token: Token = { hexString: base64ToHexString(tokenBase64), isMaster: isMaster, isBlinded: false }; // All QR codes must store unblinded Tokens
    const r: R = { hexString: base64ToHexString(rBase64), isMaster: isMaster };
    validateToken(token)
    validateR(r)
    return { token, r };
}

/**
 * Derives deterministically an election-specific R from a master R and an unblinded election token.
 * It iteratively calculates R using the election ID, master R, and a nonce until finding an R that
 * leads to a blinded token starting with '0x1'.
 *
 * @param {number} electionID - The unique identifier of the election.
 * @param {R} masterR - The master R used for deriving the election-specific R.
 * @param {Token} unblindedElectionToken - The unblinded, election-specific token associated, which must not be blinded or a master token.
 * @param {RSAParams} rsaParams - The RSA parameters including the modulus.
 * @returns {R} An R object representing the derived election-specific R.
 * @throws {Error} If invalid inputs are provided or if the input token is a master or already blinded token.
 */
export function deriveElectionR(electionID: number, masterR: R, unblindedElectionToken: Token, rsaParams: RSAParams): R {
    validateElectionID(electionID)
    validateR(masterR)
    validateToken(unblindedElectionToken)
    validateRSAParams(rsaParams)

    if (unblindedElectionToken.isMaster) {
        throw new Error("Master Token cannot be used for R Generation")
    }

    if (unblindedElectionToken.isBlinded) {
        throw new Error("Only unblinded Tokens can be used for R Generation")
    }

    if (!masterR.isMaster) {
        throw new Error("Only Master R can be used for R Generation")
    }


    let iterations: number = 0
    let blindedToken: Token;
    let nonce: bigint = 0n;

    // Initial calculation of electionR as bigint
    let electionRSeed:string = ethers.sha256(ethers.toUtf8Bytes(`${electionID}|${masterR.hexString}|${0}`))
    let electionRBig: bigint = hexStringToBigInt(padMessage(electionRSeed, rsaParams.NbitLength))
    let electionR: R;
    do {
        iterations++;
        let gcd: bigint;

        // Recalculate electionR with an incremented nonce until a valid R, generating a 0x1 prefixed blinded token
        do {
            if (nonce > 0n) {
                electionRSeed = ethers.sha256(ethers.toUtf8Bytes(`${electionID}|${masterR.hexString}|${nonce}`))
                electionRBig = hexStringToBigInt(padMessage(electionRSeed, rsaParams.NbitLength))
            }
            nonce = nonce + 1n;
            electionRBig = electionRBig % rsaParams.N;
            gcd = gcdBigInt(electionRBig, rsaParams.N);
        } while (
            gcd !== 1n ||
            electionRBig >= rsaParams.N ||
            electionRBig <= 1n
        );

        electionR = { hexString: electionRSeed, isMaster: false }
        blindedToken = blindToken(unblindedElectionToken, electionR, rsaParams)

        validateToken(blindedToken, false)

    } while (!blindedToken.hexString.startsWith(PREFIX_BLINDED_TOKEN)); // Ensure blinded token has a '0x1' prefix

    validateR(electionR)
    return electionR;
}

/**
 * Derives an election-specific, '0x0' prefixed unblinded token from a given master token.
 *
 * @param electionID - The unique identifier of the election.
 * @param masterToken - The master token used for derivation.
 * @returns A Token object representing the derived unblinded election-specific token.
 * @throws Error if the provided token is not a master token or blinded.
 */
export function deriveElectionUnblindedToken(electionID: number, masterToken: Token): Token {

    validateElectionID(electionID)
    validateToken(masterToken)

    if (!masterToken.isMaster) {
        throw new Error("Only Master Token can be used to derive Election Token")
    }

    if (masterToken.isBlinded) {
        throw new Error("Only unblinded Master Token can be used to derive Election Token")
    }

    let nonce = 0;
    let tokenHexString;
    do {
        tokenHexString = ethers.sha256(ethers.toUtf8Bytes(`${electionID}|${masterToken.hexString}|${nonce}`))
        nonce++;
    } while (!tokenHexString.startsWith(PREFIX_UNBLINDED_TOKEN)); // Ensure token has a '0x0' prefix
    return { hexString: tokenHexString, isMaster: false, isBlinded: false }
}


/**
 * Performs the blinding of an unblinded token using a given R and RSA parameters.
 *
 * @param {Token} unblindedToken - The unblinded token to be blinded.
 * @param {R} r - The R value used in the blinding process.
 * @param {RSAParams} rsaParams - The RSA parameters including the public exponent and modulus.
 * @returns {Token} A Token object representing the blinded token.
 * @throws {Error} If the token or R is invalid, or if RSA parameters are missing or invalid.
 */
export function blindToken(unblindedToken: Token, r: R, rsaParams: RSAParams): Token {
    if (!rsaParams.e) { throw new Error("Register public Exponent not defined") }
    validateToken(unblindedToken)
    validateR(r)
    validateRSAParams(rsaParams)

    if (unblindedToken.isBlinded) {
        throw new Error("Only unblinded Tokens can be blinded")
    }

    if (unblindedToken.isMaster) {
        throw new Error("Not allowed not blind a Master Token")
    }

    if (r.isMaster) {
        throw new Error("Not allowed to blind with Master R")
    }

    if (!rsaParams.e) {
        throw new Error("RSA Parameter e not defined")
    }


    // Pad Unblinded Token to be full-domain
    const unblindedTokenHex: string = unblindedToken.hexString.toLowerCase();
    const paddedTokenHex: string = padMessage(unblindedTokenHex, rsaParams.NbitLength)
    const paddedTokenBig: bigint = BigInt(paddedTokenHex);

    if (paddedTokenBig < 3n || paddedTokenBig > rsaParams.N - 1n) {
        throw new Error("Padded Token out of range")
    }
    const paddedRbig: bigint = hexStringToBigInt(padMessage(r.hexString, rsaParams.NbitLength))

    const blindedHexBig: bigint = (paddedTokenBig * modPow(paddedRbig, rsaParams.e, rsaParams.N)) % rsaParams.N;
    const blindedToken: Token = {
        hexString: '0x' + blindedHexBig.toString(16).padStart(rsaParams.NbitLength / 4, '0'),
        isMaster: unblindedToken.isMaster,
        isBlinded: true
    }
    validateToken(blindedToken, false)
    return blindedToken
}


/**
 * Pads a message using SHAKE256 to a bit length of (bitLength - 1).
 *
 * @param {string} message - The message to pad.
 * @param {number} bitLength - The bit length to pad the message to (actual padding will be to bitLength - 1).
 * @returns {string} The padded message in hexadecimal format.
 */
export function padMessage(message: string, bitLength: number): string {
    const shake = shake256.create(bitLength - 1);
    shake.update(message.toLowerCase());
    return '0x' + shake.hex();
}

/**
 * Verifies whether an unblinded signature corresponds to a given unblinded token.
 *
 * @param {Signature} unblindedSignature - The signature object after unblinding.
 * @param {Token} unblindedToken - The unblinded token object that was signed.
 * @param {RSAParams} rsaParams - The RSA public key parameters of the signer.
 * @returns {boolean} Returns true if the unblinded signature corresponds to the unblinded token, false otherwise.
 *
 * @throws {Error} If the signature is blinded, if the token is a master token, if the token is blinded, or if RSA parameters are missing.
 */
export function verifyUnblindedSignature(unblindedSignature: Signature, unblindedToken: Token, rsaParams: RSAParams): Boolean {

    validateSignature(unblindedSignature)
    validateToken(unblindedToken)
    validateRSAParams(rsaParams)

    if (!rsaParams.e) {
        throw new Error("Register public Exponent not defined")
    }
    if (unblindedSignature.isBlinded) {
        throw Error("Must provide unblinded Signature")
    }
    if (unblindedToken.isMaster) {
        throw Error("Unblinded Token must not be master Token")
    }
    if (unblindedToken.isBlinded) {
        throw Error("Unblinded Token must not be blinded")
    }

    const unblindedTokenBig = hexStringToBigInt(unblindedToken.hexString)
    if (unblindedTokenBig <= 2n || unblindedTokenBig >= rsaParams.N - 1n) {
        throw new Error("Invalid unblinded token: out of range");
    }
    const padHexVerify = padMessage(unblindedToken.hexString.toLowerCase(), rsaParams.NbitLength)
    const paddedTokenBigVerify = hexStringToBigInt(padHexVerify);

    const unblindedSignatureBig = hexStringToBigInt(unblindedSignature.hexString)
    if (unblindedSignatureBig <= 2n || unblindedSignatureBig >= rsaParams.N - 1n) {
        throw new Error("Invalid unblinded signature: out of range");
    }

    const expectedTokenBig = modPow(unblindedSignatureBig, rsaParams.e, rsaParams.N)

    const isEqual = expectedTokenBig === paddedTokenBigVerify;
    return isEqual;
}



/**
 * Unblinds a blinded signature using a given R.
 *
 * @param {Signature} signature - The blinded signature to be unblinded.
 * @param {R} r - The R value used in the unblinding process.
 * @param {RSAParams} rsaParams - The RSA parameters including the modulus.
 * @returns {Signature} A Signature object representing the unblinded signature.
 * @throws {Error} If the provided signature is not blinded, or if RSA parameters are missing.
 */
export function unblindSignature(signature: Signature, r: R, rsaParams: RSAParams): Signature {

    validateSignature(signature)
    validateR(r)
    validateRSAParams(rsaParams)

    if (!signature.isBlinded) {
        throw new Error("Only blinded Signatures can be unblinded")
    }

    if (r.isMaster) {
        throw new Error("Not allowed to unblind with Master R")

    }

    // Pad and convert hex strings to BigInts for calculation
    const paddedRbig: bigint = hexStringToBigInt(padMessage(r.hexString, rsaParams.NbitLength))
    const signatureBig: bigint = hexStringToBigInt(signature.hexString);

    // Perform unblinding: (Signature_blinded * r^-1) mod N
    const rInverse = modInv(paddedRbig, rsaParams.N);
    const unblindedSigBig = (signatureBig * rInverse) % rsaParams.N;

    const unblindedSignature = { hexString: '0x' + unblindedSigBig.toString(16).padStart(rsaParams.NbitLength / 4, '0'), isBlinded: false }

    validateSignature(unblindedSignature)
    return unblindedSignature
}


/*** Helpers ***/

/**
 * Computes the GCD of two bigint numbers, using Euclidean algorithm.
 * @param a - The first bigint number.
 * @param b - The second bigint number.
 * @returns The GCD of a and b.
 */
function gcdBigInt(a: bigint, b: bigint): bigint {
    if (b === 0n) return a;
    return gcdBigInt(b, a % b);
}


