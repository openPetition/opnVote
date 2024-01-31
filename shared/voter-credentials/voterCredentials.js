"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qrToElectionCredentials = exports.concatElectionCredentialsForQR = exports.createVoterCredentials = void 0;
const ethers_1 = require("ethers");
const utils_1 = require("../utils/utils");
/**
 * Creates voter credentials for a specific election.
 * @param unblindedSignature - The unblinded signature of the voter.
 * @param unblindedElectionToken - The unblinded election token.
 * @param masterToken - The master token of the voter, which must be unblinded and a master token.
 * @param electionID - The ID of the election.
 * @returns ElectionCredentials object containing the voter's credentials.
 * @throws Error if the provided tokens or signature do not meet the required criteria.
 */
function createVoterCredentials(unblindedSignature, unblindedElectionToken, masterToken, electionID) {
    if (masterToken.isBlinded) {
        throw new Error("Master token must be unblinded.");
    }
    if (!masterToken.isMaster) {
        throw new Error("Provided token must be a master token.");
    }
    (0, utils_1.validateToken)(unblindedElectionToken);
    (0, utils_1.validateToken)(masterToken);
    (0, utils_1.validateSignature)(unblindedSignature);
    // Convert the election ID to hex and validate
    const electionIDHex = { hexString: ethers_1.ethers.toBeHex(electionID, 32) };
    (0, utils_1.validateHexString)(electionIDHex, 66);
    // Combine master token and election ID to hex strings to derive the election-specific voter wallet private key
    const combinedHex = '0x' + masterToken.hexString.substring(2) + electionIDHex.hexString.substring(2);
    const walletPrivKey = ethers_1.ethers.sha256(combinedHex);
    const voterWallet = new ethers_1.ethers.Wallet(walletPrivKey);
    const voterCredentials = { unblindedSignature, unblindedElectionToken, voterWallet, electionID };
    (0, utils_1.validateCredentials)(voterCredentials);
    return voterCredentials;
}
exports.createVoterCredentials = createVoterCredentials;
/**
 * Encodes voter credentials to a QR code string.
 * Length calculation: 88 (signature) + 2*44 (token and priv key) + 3 (delimiters) + length of election ID.
 * @param voterCredentials - The ElectionCredentials to be encoded.
 * @returns A concatenated Base64 string of the encoded credentials.
 */
function concatElectionCredentialsForQR(voterCredentials) {
    (0, utils_1.validateCredentials)(voterCredentials);
    const voterWalletPrivKey = { hexString: voterCredentials.voterWallet.privateKey };
    const unblindedSignatureBase64 = (0, utils_1.hexStringToBase64)(voterCredentials.unblindedSignature, 130);
    const unblindedElectionTokenBase64 = (0, utils_1.hexStringToBase64)(voterCredentials.unblindedElectionToken, 66);
    const voterWalletPrivKeyBase64 = (0, utils_1.hexStringToBase64)(voterWalletPrivKey, 66);
    return `${unblindedSignatureBase64}|${unblindedElectionTokenBase64}|${voterWalletPrivKeyBase64}|${voterCredentials.electionID}`;
}
exports.concatElectionCredentialsForQR = concatElectionCredentialsForQR;
/**
 * Decodes a QR code string into voter credentials.
 * @param concatenatedBase64 - The concatenated Base64 string representing the encoded credentials.
 * @returns ElectionCredentials object obtained from the decoded QR code string.
 */
function qrToElectionCredentials(concatenatedBase64) {
    // Split the string using the '|' delimiter
    const [unblindedSignatureBase64, unblindedElectionTokenBase64, voterWalletPrivKeyBase64, electionID] = concatenatedBase64.split('|');
    // Decode the Base64 strings into signate, token and privKey objects
    const unblindedSignature = { hexString: (0, utils_1.base64ToHexString)(unblindedSignatureBase64), isBlinded: false }; // Credential QR codes must store blinded Signatures
    const unblindedElectionToken = { hexString: (0, utils_1.base64ToHexString)(unblindedElectionTokenBase64), isBlinded: false, isMaster: false }; // Credential QR Code must not store blinded Tokens or master tokens
    const voterWalletPrivKey = (0, utils_1.base64ToHexString)(voterWalletPrivKeyBase64);
    const voterWallet = new ethers_1.ethers.Wallet(voterWalletPrivKey);
    const voterCredentials = { unblindedSignature: unblindedSignature, unblindedElectionToken: unblindedElectionToken, electionID: parseInt(electionID), voterWallet: voterWallet };
    (0, utils_1.validateCredentials)(voterCredentials);
    return voterCredentials;
}
exports.qrToElectionCredentials = qrToElectionCredentials;
