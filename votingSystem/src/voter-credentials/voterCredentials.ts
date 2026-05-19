import { ethers } from "ethers";
import { ElectionCredentials, EncryptionKey, EncryptionType, MasterKey, BlsSignature, Token, WalletPrivateKey } from "../types/types";
import { base64ToHexString, hexStringToBase64, validateBlsSignature, validateCredentials, validateHexString, validateMasterKey, validateToken } from "../utils/utils";
import { BLS_G1_HEX_LENGTH } from "../utils/constants";
import { deriveElectionWallet } from "../blind-signature/generateTokens";


/**
 * Creates voter credentials for a specific election
 * @param unblindedSignature - Unblinded signature of the voter
 * @param masterKey - Master key of the voter
 * @param electionID - ID of the election
 * @returns ElectionCredentials for the voter
 * @throws if any provided input is invalid
 */
export function createVoterCredentials(unblindedSignature: BlsSignature, masterKey: MasterKey, electionID: number): ElectionCredentials {
    validateBlsSignature(unblindedSignature);
    validateMasterKey(masterKey);

    const electionIDHex = { hexString: ethers.toBeHex(electionID, 32) };
    validateHexString(electionIDHex, 66, false, true);

    const voterWallet = deriveElectionWallet(masterKey, electionID);

    const encryptionKeyInput = '0x' + masterKey.hexString.substring(2) + "|" + "Encryption-Key" + "|" + electionIDHex.hexString.substring(2);
    const encryptionKey: EncryptionKey = { hexString: ethers.sha256(ethers.toUtf8Bytes(encryptionKeyInput)), encryptionType: EncryptionType.AES };

    const voterCredentials: ElectionCredentials = { unblindedSignature, voterWallet, encryptionKey, electionID };
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

    const voterWalletPrivKey: WalletPrivateKey = { hexString: voterCredentials.voterWallet.privateKey }
    const unblindedSignatureBase64 = hexStringToBase64(voterCredentials.unblindedSignature, BLS_G1_HEX_LENGTH)
    const voterWalletPrivKeyBase64 = hexStringToBase64(voterWalletPrivKey, 66)
    const encryptionKeyBase64 = hexStringToBase64(voterCredentials.encryptionKey, 66)

    return `${unblindedSignatureBase64}|${voterWalletPrivKeyBase64}|${encryptionKeyBase64}|${voterCredentials.electionID}`;


}

/**
 * Decodes a QR code string into voter credentials.
 * @param concatenatedBase64 - The concatenated Base64 string representing the encoded credentials.
 * @returns {ElectionCredentials} ElectionCredentials object obtained from the decoded QR code string.
 */
export function qrToElectionCredentials(concatenatedBase64: string): ElectionCredentials {

    // Split the string using the '|' delimiter
    const [unblindedSignatureBase64, voterWalletPrivKeyBase64, encryptionKeyBase64, electionID] = concatenatedBase64.split('|');

    const unblindedSignature: BlsSignature = { hexString: base64ToHexString(unblindedSignatureBase64), isBlinded: false };
    const voterWalletPrivKey: WalletPrivateKey = { hexString: base64ToHexString(voterWalletPrivKeyBase64) }
    const encryptionKey: EncryptionKey = { hexString: base64ToHexString(encryptionKeyBase64), encryptionType: EncryptionType.AES }

    const voterWallet = new ethers.Wallet(voterWalletPrivKey.hexString)

    const voterCredentials: ElectionCredentials = { unblindedSignature, voterWallet, encryptionKey, electionID: parseInt(electionID) }
    validateCredentials(voterCredentials)
    return voterCredentials;
}
