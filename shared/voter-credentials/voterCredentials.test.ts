import { ethers } from "ethers";
import { blindToken, deriveElectionR, deriveElectionUnblindedToken, generateMasterTokenAndMasterR, unblindSignature } from "../blind-signature/generateTokens";
import { signToken, validateCredentials } from "../utils/utils";
import { concatElectionCredentialsForQR, createVoterCredentials, qrToElectionCredentials } from "./voterCredentials";


describe('createVoterCredentials', () => {
  it('should create valid voter credentials', () => {
    const { masterToken, masterR } = generateMasterTokenAndMasterR();
    const electionID = 0
    const unblindedElectionToken = deriveElectionUnblindedToken(electionID, masterToken);
    const electionR = deriveElectionR(electionID, masterR, unblindedElectionToken);
    const blindedElectionToken = blindToken(unblindedElectionToken, electionR)
    const blindedSignature = signToken(blindedElectionToken)
    const unblindedSignature = unblindSignature(blindedSignature, electionR)

    // Creating voter Credentials for specific Election
    const voterCredentials = createVoterCredentials(unblindedSignature, unblindedElectionToken, masterToken, electionID);

    // Validating created voter Credentials
    const expectedVoterWalletPrivKey = ethers.sha256('0x' + masterToken.hexString.substring(2) + ethers.toBeHex(electionID, 32).substring(2));

    expect(() => validateCredentials(voterCredentials)).not.toThrow();
    expect(voterCredentials.unblindedSignature.hexString).toBe(unblindedSignature.hexString);
    expect(voterCredentials.unblindedSignature.isBlinded).toBe(false);
    expect(voterCredentials.unblindedElectionToken.hexString).toBe(unblindedElectionToken.hexString);
    expect(voterCredentials.unblindedElectionToken.isBlinded).toBe(false);
    expect(voterCredentials.unblindedElectionToken.isMaster).toBe(false);
    expect(voterCredentials.electionID).toBe(electionID);
    expect(voterCredentials.voterWallet.privateKey).toBe(expectedVoterWalletPrivKey)


  });
});


describe('QR Code Encode and Decode', () => {
  it('should correctly encode credentials to a QR code and decode back to the same credentials', () => {
    // Generate initial credentials
    const { masterToken, masterR } = generateMasterTokenAndMasterR();
    const electionID = 1;
    const unblindedElectionToken = deriveElectionUnblindedToken(electionID, masterToken);
    const electionR = deriveElectionR(electionID, masterR, unblindedElectionToken);
    const blindedElectionToken = blindToken(unblindedElectionToken, electionR);
    const blindedSignature = signToken(blindedElectionToken);
    const unblindedSignature = unblindSignature(blindedSignature, electionR);
    const originalCredentials = createVoterCredentials(unblindedSignature, unblindedElectionToken, masterToken, electionID);
    expect(() => validateCredentials(originalCredentials)).not.toThrow();


    const expectedQrLength = 88 + 2 * 44 + 3 + electionID.toString().length // QR Code length: 88(Sig)+2*44(Token,Privkey) + 3 Delimiter + election ID length 

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