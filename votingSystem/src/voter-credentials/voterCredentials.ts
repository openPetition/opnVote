import { ethers } from "ethers";
import { ElectionCredentials, EncryptionKey, Signature, Token, WalletPrivateKey, } from "../types/types";
import { base64ToHexString, hexStringToBase64, validateCredentials, validateHexString, validateSignature, validateToken } from "../utils/utils";
import { RSA_BIT_LENGTH } from "../utils/constants";


/**
 * Creates voter credentials for a specific election.
 * @param unblindedSignature - The unblinded signature of the voter.
 * @param unblindedElectionToken - The unblinded election token.
 * @param masterToken - The master token of the voter, which must be unblinded and a master token.
 * @param electionID - The ID of the election.
 * @returns {ElectionCredentials} ElectionCredentials object containing the voter's credentials.
 * @throws {Error} If the provided tokens or signature do not meet the required criteria.
 */
export function createVoterCredentials(unblindedSignature: Signature, unblindedElectionToken: Token, masterToken: Token, electionID: number): ElectionCredentials {
    if (masterToken.isBlinded) {
        throw new Error("Master token must be unblinded.");
    }
    if (!masterToken.isMaster) {
        throw new Error("Provided token must be a master token.");
    }

    validateSignature(unblindedSignature);
    validateToken(unblindedElectionToken);
    validateToken(masterToken);

    // Convert the election ID to hex and validate
    const electionIDHex = { hexString: ethers.toBeHex(electionID, 32) };
    validateHexString(electionIDHex, 66, false, true);

    // Combine master token and election ID to hex strings to derive the election-specific voter wallet private key and encryption key (user encrypted vote)

    const walletPrivKeyInput = '0x' + masterToken.hexString.substring(2) + "|" + "Ethereum-Wallet" + "|" + electionIDHex.hexString.substring(2);
    const walletPrivKey: WalletPrivateKey = { hexString: ethers.sha256(ethers.toUtf8Bytes(walletPrivKeyInput)) };

    const encryptionKeyInput = '0x' + masterToken.hexString.substring(2) + "|" + "Encryption-Key" + "|" + electionIDHex.hexString.substring(2);
    const encryptionKey: EncryptionKey = { hexString: ethers.sha256(ethers.toUtf8Bytes(encryptionKeyInput)) };

    const voterWallet: ethers.Wallet = new ethers.Wallet(walletPrivKey.hexString);
    const voterCredentials: ElectionCredentials = { unblindedSignature, unblindedElectionToken, voterWallet, encryptionKey, electionID };
    validateCredentials(voterCredentials);

    return voterCredentials;
}


/**
 * Encodes voter credentials to a QR code string.
 * Length calculation: 344 (signature) + 2*44 (token and priv key) + 3 (delimiters) + length of election ID.
 * @param voterCredentials - The ElectionCredentials to be encoded.
 * @returns A concatenated Base64 string of the encoded credentials.
 */
export function concatElectionCredentialsForQR(voterCredentials: ElectionCredentials): string {
    validateCredentials(voterCredentials)
    const unblindedSignatureLength = (RSA_BIT_LENGTH / 4) + 2

    const voterWalletPrivKey: WalletPrivateKey = { hexString: voterCredentials.voterWallet.privateKey }
    const unblindedSignatureBase64 = hexStringToBase64(voterCredentials.unblindedSignature, unblindedSignatureLength)
    const unblindedElectionTokenBase64 = hexStringToBase64(voterCredentials.unblindedElectionToken, 66)
    const voterWalletPrivKeyBase64 = hexStringToBase64(voterWalletPrivKey, 66)
    const encryptionKeyBase64 = hexStringToBase64(voterCredentials.encryptionKey, 66)

    return `${unblindedSignatureBase64}|${unblindedElectionTokenBase64}|${voterWalletPrivKeyBase64}|${encryptionKeyBase64}|${voterCredentials.electionID}`;


}


/**
 * Decodes a QR code string into voter credentials.
 * @param concatenatedBase64 - The concatenated Base64 string representing the encoded credentials.
 * @returns {ElectionCredentials} ElectionCredentials object obtained from the decoded QR code string.
 */
export function qrToElectionCredentials(concatenatedBase64: string): ElectionCredentials {

    // Split the string using the '|' delimiter
    const [unblindedSignatureBase64, unblindedElectionTokenBase64, voterWalletPrivKeyBase64, encryptionKeyBase64, electionID] = concatenatedBase64.split('|');

    // Decode the Base64 strings into signate, token and privKey objects
    const unblindedSignature: Signature = { hexString: base64ToHexString(unblindedSignatureBase64), isBlinded: false }; // Credential QR codes must store blinded Signatures
    const unblindedElectionToken: Token = { hexString: base64ToHexString(unblindedElectionTokenBase64), isBlinded: false, isMaster: false }; // Credential QR Code must not store blinded Tokens or master tokens
    const voterWalletPrivKey: WalletPrivateKey = { hexString: base64ToHexString(voterWalletPrivKeyBase64) }
    const encryptionKey: EncryptionKey = { hexString: base64ToHexString(encryptionKeyBase64) }

    const voterWallet = new ethers.Wallet(voterWalletPrivKey.hexString)

    const voterCredentials: ElectionCredentials = { unblindedSignature: unblindedSignature, unblindedElectionToken: unblindedElectionToken, voterWallet: voterWallet, encryptionKey: encryptionKey, electionID: parseInt(electionID) }
    validateCredentials(voterCredentials)
    return voterCredentials;
}
