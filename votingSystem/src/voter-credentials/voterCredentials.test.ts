import { ethers } from "ethers";
import { blindToken, deriveElectionR, deriveElectionUnblindedToken, generateMasterTokenAndMasterR, unblindSignature } from "../blind-signature/generateTokens";
import { signToken, validateCredentials } from "../utils/utils";
import { concatElectionCredentialsForQR, createVoterCredentials, qrToElectionCredentials } from "./voterCredentials";
import { TestRegister } from "../config";
import { ElectionCredentials, EncryptionKey, EncryptionType, WalletPrivateKey } from "../types/types";


describe('createVoterCredentials', () => {
  it('should create valid voter credentials', () => {
    const { masterToken, masterR } = generateMasterTokenAndMasterR();
    const electionID = 0
    const unblindedElectionToken = deriveElectionUnblindedToken(electionID, masterToken);
    const electionR = deriveElectionR(electionID, masterR, unblindedElectionToken, TestRegister);
    const blindedElectionToken = blindToken(unblindedElectionToken, electionR, TestRegister)
    const blindedSignature = signToken(blindedElectionToken, TestRegister)
    const unblindedSignature = unblindSignature(blindedSignature, electionR, TestRegister)

    // Creating voter Credentials for specific Election
    const voterCredentials: ElectionCredentials = createVoterCredentials(unblindedSignature, unblindedElectionToken, masterToken, electionID);

    // Validating created voter Credentials
    const expectedVoterWalletPrivKey: WalletPrivateKey = { hexString: ethers.sha256(ethers.toUtf8Bytes('0x' + masterToken.hexString.substring(2) + "|Ethereum-Wallet|" + ethers.toBeHex(electionID, 32).substring(2))) };
    const expectedEncryptionKey: EncryptionKey = { hexString: ethers.sha256(ethers.toUtf8Bytes('0x' + masterToken.hexString.substring(2) + "|Encryption-Key|" + ethers.toBeHex(electionID, 32).substring(2))), encryptionType: EncryptionType.AES };

    expect(() => validateCredentials(voterCredentials)).not.toThrow();
    expect(voterCredentials.unblindedSignature.hexString).toBe(unblindedSignature.hexString);
    expect(voterCredentials.unblindedSignature.isBlinded).toBe(false);
    expect(voterCredentials.unblindedElectionToken.hexString).toBe(unblindedElectionToken.hexString);
    expect(voterCredentials.unblindedElectionToken.isBlinded).toBe(false);
    expect(voterCredentials.unblindedElectionToken.isMaster).toBe(false);
    expect(voterCredentials.electionID).toBe(electionID);
    expect(voterCredentials.voterWallet.privateKey).toBe(expectedVoterWalletPrivKey.hexString)
    expect(voterCredentials.voterWallet.privateKey).not.toBe(expectedEncryptionKey.hexString)
    expect(voterCredentials.encryptionKey.hexString).toBe(expectedEncryptionKey.hexString)


  });
});


describe('QR Code Encode and Decode', () => {
  it('should correctly encode credentials to a QR code and decode back to the same credentials', () => {
    // Generate initial credentials
    const { masterToken, masterR } = generateMasterTokenAndMasterR();
    const electionID = 1;
    const unblindedElectionToken = deriveElectionUnblindedToken(electionID, masterToken);
    const electionR = deriveElectionR(electionID, masterR, unblindedElectionToken, TestRegister);
    const blindedElectionToken = blindToken(unblindedElectionToken, electionR, TestRegister);
    const blindedSignature = signToken(blindedElectionToken, TestRegister);
    const unblindedSignature = unblindSignature(blindedSignature, electionR, TestRegister);
    const originalCredentials = createVoterCredentials(unblindedSignature, unblindedElectionToken, masterToken, electionID);
    expect(() => validateCredentials(originalCredentials)).not.toThrow();

    const expectedQrLength = 344 + 3 * 44 + 4 + electionID.toString().length // QR Code length: 344(Sig)+3*44(Token,Privkey,EncryptionKey) + 4 Delimiter + election ID length

    // Encode to QR code
    const qrCodeString = concatElectionCredentialsForQR(originalCredentials);

    expect(qrCodeString.length).toBe(expectedQrLength)

    // Decode back from QR code
    const decodedCredentials = qrToElectionCredentials(qrCodeString);

    // Compare original and decoded credentials
    expect(decodedCredentials.unblindedSignature.hexString).toBe(originalCredentials.unblindedSignature.hexString);
    expect(decodedCredentials.unblindedElectionToken.hexString).toBe(originalCredentials.unblindedElectionToken.hexString);
    expect(decodedCredentials.voterWallet.privateKey).toBe(originalCredentials.voterWallet.privateKey);
    expect(decodedCredentials.electionID).toBe(originalCredentials.electionID);
    expect(() => validateCredentials(decodedCredentials)).not.toThrow();

  });
});
