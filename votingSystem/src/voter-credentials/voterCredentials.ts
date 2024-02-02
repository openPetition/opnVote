import { ethers } from "ethers";
import { ElectionCredentials, Signature, Token, } from "../types/types";
import { base64ToHexString, hexStringToBase64, validateCredentials, validateHexString, validateSignature, validateToken } from "../utils/utils";


/**
 * Creates voter credentials for a specific election.
 * @param unblindedSignature - The unblinded signature of the voter.
 * @param unblindedElectionToken - The unblinded election token.
 * @param masterToken - The master token of the voter, which must be unblinded and a master token.
 * @param electionID - The ID of the election.
 * @returns ElectionCredentials object containing the voter's credentials.
 * @throws Error if the provided tokens or signature do not meet the required criteria.
 */
export function createVoterCredentials(unblindedSignature: Signature, unblindedElectionToken: Token, masterToken: Token, electionID: number): ElectionCredentials {
    if (masterToken.isBlinded) {
        throw new Error("Master token must be unblinded.");
    }
    if (!masterToken.isMaster) {
        throw new Error("Provided token must be a master token.");
    }

    validateToken(unblindedElectionToken);
    validateToken(masterToken);
    validateSignature(unblindedSignature);

    // Convert the election ID to hex and validate
    const electionIDHex = { hexString: ethers.toBeHex(electionID, 32) };
    validateHexString(electionIDHex, 66);

    // Combine master token and election ID to hex strings to derive the election-specific voter wallet private key
    const combinedHex = '0x' + masterToken.hexString.substring(2) + electionIDHex.hexString.substring(2);
    const walletPrivKey = ethers.sha256(combinedHex);
    const voterWallet = new ethers.Wallet(walletPrivKey);

    const voterCredentials: ElectionCredentials = { unblindedSignature, unblindedElectionToken, voterWallet, electionID };
    validateCredentials(voterCredentials);

    return voterCredentials;
}


/**
 * Encodes voter credentials to a QR code string.
 * Length calculation: 88 (signature) + 2*44 (token and priv key) + 3 (delimiters) + length of election ID.
 * @param voterCredentials - The ElectionCredentials to be encoded.
 * @returns A concatenated Base64 string of the encoded credentials.
 */
export function concatElectionCredentialsForQR(voterCredentials: ElectionCredentials): string {

    validateCredentials(voterCredentials)

    const voterWalletPrivKey = { hexString: voterCredentials.voterWallet.privateKey }
    const unblindedSignatureBase64 = hexStringToBase64(voterCredentials.unblindedSignature, 130)
    const unblindedElectionTokenBase64 = hexStringToBase64(voterCredentials.unblindedElectionToken, 66)
    const voterWalletPrivKeyBase64 = hexStringToBase64(voterWalletPrivKey, 66)

    return `${unblindedSignatureBase64}|${unblindedElectionTokenBase64}|${voterWalletPrivKeyBase64}|${voterCredentials.electionID}`;
}


/**
 * Decodes a QR code string into voter credentials.
 * @param concatenatedBase64 - The concatenated Base64 string representing the encoded credentials.
 * @returns ElectionCredentials object obtained from the decoded QR code string.
 */
export function qrToElectionCredentials(concatenatedBase64: string): ElectionCredentials {

    // Split the string using the '|' delimiter
    const [unblindedSignatureBase64, unblindedElectionTokenBase64, voterWalletPrivKeyBase64, electionID] = concatenatedBase64.split('|');

    // Decode the Base64 strings into signate, token and privKey objects
    const unblindedSignature: Signature = { hexString: base64ToHexString(unblindedSignatureBase64), isBlinded: false }; // Credential QR codes must store blinded Signatures
    const unblindedElectionToken: Token = { hexString: base64ToHexString(unblindedElectionTokenBase64), isBlinded: false, isMaster: false }; // Credential QR Code must not store blinded Tokens or master tokens
    const voterWalletPrivKey = base64ToHexString(voterWalletPrivKeyBase64)

    const voterWallet = new ethers.Wallet(voterWalletPrivKey)

    const voterCredentials: ElectionCredentials = { unblindedSignature: unblindedSignature, unblindedElectionToken: unblindedElectionToken, electionID: parseInt(electionID), voterWallet: voterWallet }
    validateCredentials(voterCredentials)
    return voterCredentials;
}
