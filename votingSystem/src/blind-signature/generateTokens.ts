import { ethers } from "ethers";
import { bls12_381 } from "@noble/curves/bls12-381";
import { bytesToNumberBE } from "@noble/curves/abstract/utils";
import { BlsParams, MasterKey, Token, R, BlsSignature } from "../types/types";
import { base64ToHexString, hexStringToBase64, hexStringToBigInt, validateBase64, validateBlsParams, validateBlsSignature, validateElectionID, validateEthAddress, validateMasterKey, validateR, validateToken } from "../utils/utils";



/*** Main methods ***/


/**
 * Generates a master key.
 * @returns MasterKey containing 32 random bytes as hex-string
 */
export function generateMasterKey(): MasterKey {
    return { hexString: ethers.hexlify(ethers.randomBytes(32)) };
}

/**
 * Encodes master key as Base64 string for QR code generation
 * @param masterKey - The master key
 * @returns Base64 string representation of master key
 */
export function masterKeyToQR(masterKey: MasterKey): string {
    validateMasterKey(masterKey);
    return hexStringToBase64(masterKey, 66);
}

/**
 * Decodes Base64-encoded master key from QR code
 * @param base64 - Base64 string
 * @returns decoded master key
 */
export function qrToMasterKey(base64: string): MasterKey {
    validateBase64(base64);
    const masterKey: MasterKey = { hexString: base64ToHexString(base64) };
    validateMasterKey(masterKey);
    return masterKey;
}

/**
 * Derives election-specific voter wallet from master key
 * @param masterKey - Master key
 * @param electionID - unique election ID
 * @returns Election-specific voter wallet
 */
export function deriveElectionWallet(masterKey: MasterKey, electionID: number): ethers.Wallet {
    validateMasterKey(masterKey)
    validateElectionID(electionID)

    const electionIDHex = ethers.toBeHex(electionID, 32)
    const walletPrivKeyInput = '0x' + masterKey.hexString.substring(2) + "|" + "Ethereum-Wallet" + "|" + electionIDHex.substring(2)
    const walletPrivKey = ethers.sha256(ethers.toUtf8Bytes(walletPrivKeyInput))
    return new ethers.Wallet(walletPrivKey)
}

/**
 * Derives unblinded election token from election ID and election-specific wallet address
 * @param electionID - Unique election ID
 * @param voterAddress - Voter wallet address
 * @returns Unblinded election Token
 */
export function deriveElectionUnblindedToken(electionID: number, voterAddress: string): Token {
    validateElectionID(electionID)
    validateEthAddress(voterAddress)
    const tokenHexString = ethers.solidityPackedKeccak256(['uint256', 'address'], [BigInt(electionID), voterAddress])
    return { hexString: tokenHexString, isBlinded: false }
}


/**
 * Generates a blinding factor R for BLS blind-signature flow
 * @returns A random R as 32-byte hex-string
 */
export function generateBlindingR(): R {
    const r = bytesToNumberBE(bls12_381.utils.randomPrivateKey())
    return { hexString: '0x' + r.toString(16).padStart(64, '0') }
}

/**
 * Blinds an unblinded token for BLS blind signing
 * @param unblindedToken - Unblinded token (message) to be blinded
 * @param r - Blinding factor
 * @returns Token with blinded G1 point (uncompressed hex)
 * @throws if token or R is invalid
 */
export function blindToken(unblindedToken: Token, r: R): Token {
    validateToken(unblindedToken)
    validateR(r)

    if (unblindedToken.isBlinded) {
        throw new Error("Token already blinded")
    }

    const msgBytes = ethers.getBytes(unblindedToken.hexString)
    const Hm = bls12_381.shortSignatures.hash(msgBytes)
    const rBig = hexStringToBigInt(r.hexString)
    const M_prime = Hm.multiply(rBig)

    const blindedToken: Token = {
        hexString: '0x' + M_prime.toHex(false),
        isBlinded: true
    }
    validateToken(blindedToken)
    return blindedToken
}

/**
 * Verifies BLS unblinded signature against unblinded token
 * @param unblindedSignature - Unblinded signature (G1 point)
 * @param unblindedToken - Unblinded token (message)
 * @param blsParams - BLS public key parameters of the signer
 * @returns true if the signature is valid for the given token and pk
 * @throws if any input is invalid; if the signature is blinded
 */
export function verifyUnblindedSignature(unblindedSignature: BlsSignature, unblindedToken: Token, blsParams: BlsParams): boolean {
    validateBlsSignature(unblindedSignature)
    validateToken(unblindedToken)
    validateBlsParams(blsParams)

    if (unblindedSignature.isBlinded) {
        throw new Error("Provided Signature is blinded")
    }
    if (unblindedToken.isBlinded) {
        throw new Error("Provided Token is blinded")
    }

    const S = bls12_381.curves.G1.fromHex(unblindedSignature.hexString.substring(2))
    const msgBytes = ethers.getBytes(unblindedToken.hexString)
    const Hm = bls12_381.shortSignatures.hash(msgBytes)
    const pk = bls12_381.curves.G2.fromHex(blsParams.pk.substring(2))

    return bls12_381.shortSignatures.verify(S, Hm, pk)
}

/**
 * Unblinds blinded BLS signature
 * @param signature - Blinded signature (G1 point)
 * @param r - Blinding factor
 * @returns Unblinded signature
 * @throws if the signature is not blinded; if R is invalid
 */
export function unblindSignature(signature: BlsSignature, r: R): BlsSignature {
    validateBlsSignature(signature)
    validateR(r)

    if (!signature.isBlinded) {
        throw new Error("Only blinded Signatures can be unblinded")
    }

    const rBig = hexStringToBigInt(r.hexString)
    const rInv = bls12_381.fields.Fr.inv(rBig)
    const S_prime = bls12_381.curves.G1.fromHex(signature.hexString.substring(2))
    const S = S_prime.multiply(rInv)

    const unblindedSignature: BlsSignature = { hexString: '0x' + S.toHex(false), isBlinded: false }
    validateBlsSignature(unblindedSignature)
    return unblindedSignature
}



