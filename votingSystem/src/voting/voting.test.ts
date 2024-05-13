import { ElectionCredentials, EncryptedVotes, Signature, Token, VoteOption } from "../types/types";
import { ethers } from "ethers";
import { addSVSSignatureToVotingTransaction, createVotingTransactionWithoutSVSSignature } from "./voting";

describe('Encryption and Decryption of Votes', () => {

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('crypto', () => ({
      constants: {
        RSA_PKCS1_OAEP_PADDING: {},
      },
      publicEncrypt: jest.fn().mockImplementation(() => Buffer.from('encrypted', 'utf8')),
      privateDecrypt: jest.fn().mockImplementation(() => Buffer.from(VoteOption.No.toString(), 'utf8')),
      createPublicKey: jest.fn().mockImplementation(({ key }) => ({
        export: () => key,
      })),
      createPrivateKey: jest.fn().mockImplementation(({ key }) => ({
        export: () => key,
      })),
    }));
  });

  it('should encrypt votes correctly', async () => {
    const votingModule = await import("./voting");
    const { encryptVotes } = votingModule;

    const votes = [{ value: VoteOption.Yes }];
    const publicKey = 'publicKey';
    const result = encryptVotes(votes, publicKey);
    const expectedResult: EncryptedVotes = { hexString: "0x656e63727970746564" }
    expect(result).toStrictEqual(expectedResult)
  });

  it('should decrypt votes correctly', async () => {
    const votingModule = await import("./voting");
    const { decryptVotes } = votingModule;

    const encryptedVotes = { hexString: '0x1234' };
    const privateKey = 'privateKey';
    const result = decryptVotes(encryptedVotes, privateKey);
    expect(result[0].value).toBe(VoteOption.No);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.unmock('crypto');
  });
});



describe('Encryption and Decryption Integration', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should encrypt and then decrypt votes back to the original', async () => {
    const votingModule = await import("./voting");
    const { encryptVotes, decryptVotes } = votingModule;
    const keyGenerationModule = await import("../admin/generateRSAKeys");
    const { generateKeyPair } = keyGenerationModule;

    const votes = [{ value: VoteOption.Yes }, { value: VoteOption.No }];
    const keyPair = generateKeyPair();
    const encryptedVotes = encryptVotes(votes, keyPair.publicKey);
    const decryptedVotes = decryptVotes(encryptedVotes, keyPair.privateKey);
    expect(decryptedVotes).toEqual(votes);
    expect(encryptedVotes.hexString).toHaveLength(514) // RSA 2048 with '0x' prefix
  });

  it('should encrypt and then decrypt 100 votes back to original', async () => {
    const votingModule = await import("./voting");
    const { encryptVotes, decryptVotes } = votingModule;
    const keyGenerationModule = await import("../admin/generateRSAKeys");
    const { generateKeyPair } = keyGenerationModule;

    // Generating 99 votes ('Yes', 'No', and 'Abstain')
    const votes = Array.from({ length: 33 }, () => ({ value: VoteOption.Yes }))
      .concat(Array.from({ length: 33 }, () => ({ value: VoteOption.No })))
      .concat(Array.from({ length: 33 }, () => ({ value: VoteOption.Abstain })));

    const keyPair = generateKeyPair();
    const encryptedVotes = encryptVotes(votes, keyPair.publicKey);
    const decryptedVotes = decryptVotes(encryptedVotes, keyPair.privateKey);

    expect(decryptedVotes).toEqual(votes);
    expect(encryptedVotes.hexString).toHaveLength(514) // RSA 2048 with '0x' prefix

  });
});


describe('Edge Cases for Encryption and Decryption', () => {
  let generateKeyPair: () => { publicKey: string; privateKey: string; }

  beforeAll(async () => {
    const keyGenerationModule = await import("../admin/generateRSAKeys");
    generateKeyPair = keyGenerationModule.generateKeyPair;
  });


  it('should throw an error when trying to encrypt an empty vote array', async () => {
    const { encryptVotes } = await import("./voting");
    const keyPair = generateKeyPair();
    expect(() => encryptVotes([], keyPair.publicKey)).toThrow("Encryption error: No votes provided.");
  });

  it('should throw an error if encrypted data is incorrectly formatted', async () => {
    const { decryptVotes } = await import("./voting");
    const keyPair = generateKeyPair();

    const invalidEncryptedVotes = { hexString: '12345' }; // Missing '0x' prefix
    expect(() => decryptVotes(invalidEncryptedVotes, keyPair.privateKey)).toThrow("Decryption error: No valid encrypted data provided.");

    const emptyHexString = { hexString: '0x' }; // No data
    expect(() => decryptVotes(emptyHexString, keyPair.privateKey)).toThrow("Decryption error: No valid encrypted data provided.");

    const missingHexString = { hexString: '' }; // Empty string
    expect(() => decryptVotes(missingHexString, keyPair.privateKey)).toThrow("Decryption error: No valid encrypted data provided.");
  });

  it('should fail to decrypt with a wrong private key', async () => {
    const { encryptVotes, decryptVotes } = await import("./voting");

    const encryptionKeyPair = generateKeyPair();
    const decryptionKeyPair = generateKeyPair();

    expect(encryptionKeyPair.publicKey).not.toBe(decryptionKeyPair.publicKey);
    expect(encryptionKeyPair.privateKey).not.toBe(decryptionKeyPair.privateKey);

    const votes = [{ value: VoteOption.Yes }, { value: VoteOption.No }];
    const encryptedVotes = encryptVotes(votes, encryptionKeyPair.publicKey);

    expect(encryptedVotes.hexString).toHaveLength(514) // RSA 2048 with '0x' prefix
    expect(() => decryptVotes(encryptedVotes, decryptionKeyPair.privateKey)).toThrow();

  });
});


describe('createVotingTransactionWithoutSVSSignature', () => {
  it('should create a transaction with the correct properties', () => {
    const voterWallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey)
    const dummyToken: Token = { hexString: "0x0000000000000000000000000000000000000000000000000000000000000000", isMaster: false, isBlinded: false }
    const dummySignature: Signature = { hexString: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", isBlinded: false }
    const voterCredentials: ElectionCredentials = {
      electionID: 1,
      voterWallet: voterWallet,
      unblindedElectionToken: dummyToken,
      unblindedSignature: dummySignature
    };
    const dummyEncryptedVotes = { hexString: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' };

    const transaction = createVotingTransactionWithoutSVSSignature(voterCredentials, dummyEncryptedVotes);

    expect(transaction.electionID).toBe(voterCredentials.electionID);
    expect(transaction.voterAddress).toBe(voterCredentials.voterWallet.address);
    expect(transaction.encryptedVote).toBe(dummyEncryptedVotes);
    expect(transaction.unblindedElectionToken).toBe(voterCredentials.unblindedElectionToken);
    expect(transaction.unblindedSignature).toBe(voterCredentials.unblindedSignature);
    expect(transaction.svsSignature).toBeNull();
  });
});


describe('addSVSSignatureToVotingTransaction', () => {
  it('should add an SVS signature correctly', () => {
    const dummyToken: Token = { hexString: "0x0000000000000000000000000000000000000000000000000000000000000000", isMaster: false, isBlinded: false }
    const dummySignature: Signature = { hexString: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", isBlinded: false }
    const dummyEncryptedVotes = { hexString: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' };

    const transaction = {
      electionID: 1,
      voterAddress: '0x0000000000000000000000000000000000000000',
      encryptedVote: dummyEncryptedVotes,
      unblindedElectionToken: dummyToken,
      unblindedSignature: dummySignature,
      svsSignature: null
    };

    const svsSignature = dummySignature
    const updatedTransaction = addSVSSignatureToVotingTransaction(transaction, svsSignature);

    expect(updatedTransaction.svsSignature).toBe(svsSignature);
  });

  it('should throw if SVS signature is already present', () => {
    const dummyToken: Token = { hexString: "0x0000000000000000000000000000000000000000000000000000000000000000", isMaster: false, isBlinded: false }
    const dummySignature: Signature = { hexString: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", isBlinded: false }
    const dummyEncryptedVotes = { hexString: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' };

    const transaction = {
      electionID: 1,
      voterAddress: '0x0000000000000000000000000000000000000000',
      encryptedVote: dummyEncryptedVotes,
      unblindedElectionToken: dummyToken,
      unblindedSignature: dummySignature,
      svsSignature: dummySignature
    };
    const svsSignature = dummySignature

    expect(() => addSVSSignatureToVotingTransaction(transaction, svsSignature)).toThrow('Voting Transaction already contains SVS Signature');
  });

  it('should throw if the SVS signature is blinded', () => {
    const dummyToken: Token = { hexString: "0x0000000000000000000000000000000000000000000000000000000000000000", isMaster: false, isBlinded: false }
    const dummySignature: Signature = { hexString: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", isBlinded: false }
    const dummyEncryptedVotes = { hexString: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' };

    const transaction = {
      electionID: 1,
      voterAddress: '0x0000000000000000000000000000000000000000',
      encryptedVote: dummyEncryptedVotes,
      unblindedElectionToken: dummyToken,
      unblindedSignature: dummySignature,
      svsSignature: null
    };
    const svsSignature = { hexString: dummySignature.hexString, isBlinded: true };

    expect(() => addSVSSignatureToVotingTransaction(transaction, svsSignature)).toThrow('SVS Signature must be unblinded');
  });
});

