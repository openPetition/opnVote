"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const generateTokens_1 = require("../blind-signature/generateTokens");
const utils_1 = require("../utils/utils");
const voterCredentials_1 = require("./voterCredentials");
describe('createVoterCredentials', () => {
    it('should create valid voter credentials', () => {
        const { masterToken, masterR } = (0, generateTokens_1.generateMasterTokenAndMasterR)();
        const electionID = 0;
        const unblindedElectionToken = (0, generateTokens_1.deriveElectionUnblindedToken)(electionID, masterToken);
        const electionR = (0, generateTokens_1.deriveElectionR)(electionID, masterR, unblindedElectionToken);
        const blindedElectionToken = (0, generateTokens_1.blindToken)(unblindedElectionToken, electionR);
        const blindedSignature = (0, utils_1.signToken)(blindedElectionToken);
        const unblindedSignature = (0, generateTokens_1.unblindSignature)(blindedSignature, electionR);
        // Creating voter Credentials for specific Election
        const voterCredentials = (0, voterCredentials_1.createVoterCredentials)(unblindedSignature, unblindedElectionToken, masterToken, electionID);
        // Validating created voter Credentials
        const expectedVoterWalletPrivKey = ethers_1.ethers.sha256('0x' + masterToken.hexString.substring(2) + ethers_1.ethers.toBeHex(electionID, 32).substring(2));
        expect(() => (0, utils_1.validateCredentials)(voterCredentials)).not.toThrow();
        expect(voterCredentials.unblindedSignature.hexString).toBe(unblindedSignature.hexString);
        expect(voterCredentials.unblindedSignature.isBlinded).toBe(false);
        expect(voterCredentials.unblindedElectionToken.hexString).toBe(unblindedElectionToken.hexString);
        expect(voterCredentials.unblindedElectionToken.isBlinded).toBe(false);
        expect(voterCredentials.unblindedElectionToken.isMaster).toBe(false);
        expect(voterCredentials.electionID).toBe(electionID);
        expect(voterCredentials.voterWallet.privateKey).toBe(expectedVoterWalletPrivKey);
    });
});
describe('QR Code Encode and Decode', () => {
    it('should correctly encode credentials to a QR code and decode back to the same credentials', () => {
        // Generate initial credentials
        const { masterToken, masterR } = (0, generateTokens_1.generateMasterTokenAndMasterR)();
        const electionID = 1;
        const unblindedElectionToken = (0, generateTokens_1.deriveElectionUnblindedToken)(electionID, masterToken);
        const electionR = (0, generateTokens_1.deriveElectionR)(electionID, masterR, unblindedElectionToken);
        const blindedElectionToken = (0, generateTokens_1.blindToken)(unblindedElectionToken, electionR);
        const blindedSignature = (0, utils_1.signToken)(blindedElectionToken);
        const unblindedSignature = (0, generateTokens_1.unblindSignature)(blindedSignature, electionR);
        const originalCredentials = (0, voterCredentials_1.createVoterCredentials)(unblindedSignature, unblindedElectionToken, masterToken, electionID);
        expect(() => (0, utils_1.validateCredentials)(originalCredentials)).not.toThrow();
        const expectedQrLength = 88 + 2 * 44 + 3 + electionID.toString().length; // QR Code length: 88(Sig)+2*44(Token,Privkey) + 3 Delimiter + election ID length 
        // Encode to QR code
        const qrCodeString = (0, voterCredentials_1.concatElectionCredentialsForQR)(originalCredentials);
        expect(qrCodeString.length).toBe(expectedQrLength);
        // Decode back from QR code
        const decodedCredentials = (0, voterCredentials_1.qrToElectionCredentials)(qrCodeString);
        // Compare original and decoded credentials
        expect(decodedCredentials.unblindedSignature.hexString).toBe(originalCredentials.unblindedSignature.hexString);
        expect(decodedCredentials.unblindedElectionToken.hexString).toBe(originalCredentials.unblindedElectionToken.hexString);
        expect(decodedCredentials.voterWallet.privateKey).toBe(originalCredentials.voterWallet.privateKey);
        expect(decodedCredentials.electionID).toBe(originalCredentials.electionID);
        expect(() => (0, utils_1.validateCredentials)(decodedCredentials)).not.toThrow();
    });
});
