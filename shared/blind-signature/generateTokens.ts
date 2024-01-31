import { ethers } from "ethers";

import { modInv } from 'bigint-crypto-utils';
import { Token, R, Signature } from "../types/types";
import { base64ToHexString, hexStringToBase64, hexStringToBigInt, validateR, validateSignature, validateToken } from "../utils/utils";
import { Register } from '../config'; 



/*** Main methods ***/


/**
 * Generates an unblinded master token and a master r
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
export function deriveElectionR(electionID: number, masterR: R, unblindedElectionToken: Token): R {
    validateR(masterR)
    validateToken(unblindedElectionToken)

    if (unblindedElectionToken.isMaster) {
        throw new Error("Master Token cannot be used for R Generation")
    }

    if (unblindedElectionToken.isBlinded) {
        throw new Error("Only unblinded Tokens can be used for R Generation")
    }

    if (!masterR.isMaster) {
        throw new Error("Only Master R can be used for R Generation")
    }


    let iterations = 0
    let blindedToken: Token;
    let nonce: bigint = 0n;

    // Initial calculation of electionR as bigint
    let electionRBig: bigint = hexStringToBigInt(ethers.sha256(ethers.toUtf8Bytes(`${electionID}|${masterR.hexString}|${0}`)))
    let electionR: R;
    do {
        iterations++;
        let gcd: bigint;

        // Recalculate electionR with an incremented nonce until a valid R, generating a 0x1 prefixed blinded token
        do {
            if (nonce > 0n) {
                electionRBig = hexStringToBigInt(ethers.sha256(ethers.toUtf8Bytes(`${electionID}|${masterR.hexString}|${nonce}`)))
            }
            nonce = nonce + 1n;
            electionRBig = electionRBig % Register.N;
            gcd = gcdBigInt(electionRBig, Register.N);
        } while (
            gcd !== 1n ||
            electionRBig >= Register.N ||
            electionRBig <= 1n
        );


        const rHex = electionRBig.toString(16).padStart(64, '0');
        electionR = { hexString: "0x" + rHex, isMaster: false }
        blindedToken = blindToken(unblindedElectionToken, electionR)

    } while (!blindedToken.hexString.startsWith('0x1')); // Ensure blinded token has a '0x1' prefix

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
    } while (!tokenHexString.startsWith('0x0')); // Ensure token has a '0x0' prefix
    return { hexString: tokenHexString, isMaster: false, isBlinded: false }
}



/**
 * Performs the blinding of an unblinded token using a given R.
 *
 * @param unblindedToken - The unblinded token to be blinded.
 * @param r - The r used in the blinding process.
 * @returns A Token object representing the blinded token.
 * @throws Error if the provided token is already blinded.
 */
export function blindToken(unblindedToken: Token, r: R): Token {

    validateToken(unblindedToken)
    validateR(r)

    if (unblindedToken.isBlinded) {
        throw new Error("Only unblinded Tokens can be blinded")
    }

    if (unblindedToken.isMaster) {
        throw new Error("Not allowed not blind a Master Token")
    }

    if (r.isMaster) {
        throw new Error("Not allowed to blind with Master R")
    }

    // Convert hex strings to BigInts for calculation
    const unblindedTokenBig: bigint = hexStringToBigInt(unblindedToken.hexString);
    const rBig: bigint = hexStringToBigInt(r.hexString);

    // Perform blinding: (Token_unblinded * r^e) mod N
    const blindedHexBig = (unblindedTokenBig * rBig ** Register.e) % Register.N;
    const hexLength = Register.NbitLength / 4; // Convert bit length to hex length

    const blindedToken = {
        hexString: '0x' + blindedHexBig.toString(16).padStart(hexLength, '0'),
        isMaster: unblindedToken.isMaster,
        isBlinded: true
    }

    validateToken(blindedToken)

    return blindedToken
}

/**
 * Verifies whether an unblinded signature corresponds to a given unblinded token.
 * @param unblindedSignature - The signature object after unblinding.
 * @param unblindedToken - The unblinded token object that was signed
 * @returns Boolean - Returns true if the unblinded signature corresponds to the unblinded token, false otherwise.
 * 
 * @throws Error if the signature is blinded, if the token is a master token, or if the token is blinded.
 */
export function verifyUnblindedSignature(unblindedSignature: Signature, unblindedToken: Token): Boolean {

    validateSignature(unblindedSignature)
    validateToken(unblindedToken)

    if (unblindedSignature.isBlinded) {
        throw Error("Must provide unblinded Signature")
    }
    if (unblindedToken.isMaster) {
        throw Error("Unblinded Token must not be master Token")
    }
    if (unblindedToken.isBlinded) {
        throw Error("Unblinded Token must not be blinded")
    }


    const unblindedSignatureBig = hexStringToBigInt(unblindedSignature.hexString)
    const unblindedTokenBig = hexStringToBigInt(unblindedToken.hexString)


    const expectedTokenBig = unblindedSignatureBig ** Register.e % Register.N

    const isEqual = expectedTokenBig === unblindedTokenBig;
    return isEqual;
}



/**
 * Unblinds a blinded signature using a given R. 
 * @param signature - The blinded signature to be unblinded.
 * @param r - The r used in the unblinding process.
 * @returns A Signature object representing the unblinded signature.
 * @throws Error if the provided signature is not blinded.
 */
export function unblindSignature(signature: Signature, r: R): Signature {

    validateSignature(signature)
    validateR(r)

    if (!signature.isBlinded) {
        throw new Error("Only blinded Signatures can be unblinded")
    }

    if (r.isMaster) {
        throw new Error("Not allowed to unblind with Master R")

    }

    // Convert hex strings to BigInts for calculation
    const rBig: bigint = hexStringToBigInt(r.hexString);
    const signatureBig: bigint = hexStringToBigInt(signature.hexString);

    // Perform unblinding: (Signature_blinded * r^-1) mod N
    const rInverse = modInv(rBig, Register.N);
    const unblindedSigBig = (signatureBig * rInverse) % Register.N;
    const hexLength = Register.NbitLength / 4; // Convert bit length to hex length

    const unblindedSignature = { hexString: '0x' + unblindedSigBig.toString(16).padStart(hexLength, '0'), isBlinded: false }
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


