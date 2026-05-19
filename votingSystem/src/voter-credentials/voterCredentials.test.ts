import { ethers } from "ethers";
import { deriveElectionWallet, generateMasterKey } from "../blind-signature/generateTokens";
import { validateCredentials } from "../utils/utils";
import { concatElectionCredentialsForQR, createVoterCredentials, qrToElectionCredentials } from "./voterCredentials";
import { ElectionCredentials, BlsSignature, EncryptionKey, EncryptionType, MasterKey } from "../types/types";
import { bls12_381 } from "@noble/curves/bls12-381";


describe('createVoterCredentials', () => {
  it('should create valid voter credentials', () => {
    const masterKey: MasterKey = generateMasterKey();
    const electionID = 0;

    const voterWallet = deriveElectionWallet(masterKey, electionID);
    const unblindedSignature: BlsSignature = { hexString: '0x' + bls12_381.curves.G1.BASE.toHex(false), isBlinded: false }

    const voterCredentials: ElectionCredentials = createVoterCredentials(unblindedSignature, masterKey, electionID);

    const expectedEncryptionKey: EncryptionKey = { hexString: ethers.sha256(ethers.toUtf8Bytes('0x' + masterKey.hexString.substring(2) + "|Encryption-Key|" + ethers.toBeHex(electionID, 32).substring(2))), encryptionType: EncryptionType.AES };

    expect(() => validateCredentials(voterCredentials)).not.toThrow();
    expect(voterCredentials.unblindedSignature.hexString).toBe(unblindedSignature.hexString);
    expect(voterCredentials.unblindedSignature.isBlinded).toBe(false);
    expect(voterCredentials.electionID).toBe(electionID);
    expect(voterCredentials.voterWallet.address).toBe(voterWallet.address);
    expect(voterCredentials.voterWallet.privateKey).toBe(voterWallet.privateKey);
    expect(voterCredentials.encryptionKey.hexString).toBe(expectedEncryptionKey.hexString);
  });
});


describe('QR Code Encode and Decode', () => {
  it('should correctly encode credentials to a QR code and decode back to the same credentials', () => {
    const masterKey: MasterKey = generateMasterKey();
    const electionID = 1;

    const unblindedSignature: BlsSignature = { hexString: '0x' + bls12_381.curves.G1.BASE.toHex(false), isBlinded: false }

    const originalCredentials = createVoterCredentials(unblindedSignature, masterKey, electionID);
    expect(() => validateCredentials(originalCredentials)).not.toThrow();

    const qrCodeString = concatElectionCredentialsForQR(originalCredentials);

    const expectedQrLength = 128 + 44 + 44 + 3 + electionID.toString().length // 128(Sig) + 44(PrivKey) + 44(EncKey) + 3 del + electionID
    expect(qrCodeString.length).toBe(expectedQrLength);

    const decodedCredentials = qrToElectionCredentials(qrCodeString);

    expect(decodedCredentials.unblindedSignature.hexString).toBe(originalCredentials.unblindedSignature.hexString);
    expect(decodedCredentials.voterWallet.privateKey).toBe(originalCredentials.voterWallet.privateKey);
    expect(decodedCredentials.electionID).toBe(originalCredentials.electionID);
    expect(() => validateCredentials(decodedCredentials)).not.toThrow();
  });
});
