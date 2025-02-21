import { ElectionCredentials, EncryptedVotes, EncryptionKey, EncryptionType, EthSignature, Signature, Token, Vote, VoteOption, VotingTransaction } from "../types/types";
import { ethers } from "ethers";
import { addSVSSignatureToVotingTransaction, createVotingTransactionWithoutSVSSignature } from "./voting";
import { RSA_BIT_LENGTH } from "../utils/constants";

describe('AES: Encryption and Decryption Integration', () => {
    beforeEach(() => {
        jest.resetModules();
    });
    it('should encrypt and then decrypt 2 votes back to the original', async () => {
        const votingModule = await import("./voting");
        const { encryptVotes, decryptVotes } = votingModule;

        const votes: Array<Vote> = [{ value: VoteOption.Yes }, { value: VoteOption.No }];
        const encryptionKey: EncryptionKey = { hexString: ethers.sha256("0x"), encryptionType: EncryptionType.AES };


        const encryptedVotes: EncryptedVotes = await encryptVotes(votes, encryptionKey, EncryptionType.AES);
        const decryptedVotes: Array<Vote> = await decryptVotes(encryptedVotes, encryptionKey, EncryptionType.AES);
        expect(decryptedVotes).toEqual(votes);
        expect(encryptedVotes.hexString.length).toBe(64) //64 should be the length of 2 encrypted votes
        expect(encryptedVotes.encryptionType).toBe(EncryptionType.AES);
    });


    it('should encrypt and then decrypt 100 votes back to original', async () => {
        const votingModule = await import("./voting");
        const { encryptVotes, decryptVotes } = votingModule;


        // Generating 100 votes ('Yes', 'No', and 'Abstain')
        const votes = Array.from({ length: 34 }, () => ({ value: VoteOption.Yes }))
            .concat(Array.from({ length: 33 }, () => ({ value: VoteOption.No })))
            .concat(Array.from({ length: 33 }, () => ({ value: VoteOption.Abstain })));

        const encryptionKey: EncryptionKey = { hexString: ethers.sha256("0x"), encryptionType: EncryptionType.AES };
    
        const encryptedVotes: EncryptedVotes = await encryptVotes(votes, encryptionKey, EncryptionType.AES);
        const decryptedVotes: Array<Vote> = await decryptVotes(encryptedVotes, encryptionKey, EncryptionType.AES);

        expect(decryptedVotes).toEqual(votes);
        expect(encryptedVotes.encryptionType).toBe(EncryptionType.AES);

    });

});

describe('RSA: Encryption and Decryption Integration', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    it('should encrypt and then decrypt 2 votes back to the original', async () => {
        const votingModule = await import("./voting");
        const { encryptVotes, decryptVotes } = votingModule;
        const keyGenerationModule = await import("../admin/generateRSAKeys");
        const { generateKeyPair } = keyGenerationModule;

        const votes: Array<Vote> = [{ value: VoteOption.Yes }, { value: VoteOption.No }];
        const keyPair = await generateKeyPair();
        const encryptionKeyRSA: EncryptionKey = { hexString: keyPair.publicKey, encryptionType: EncryptionType.RSA };
        const decryptionKeyRSA: EncryptionKey = { hexString: keyPair.privateKey, encryptionType: EncryptionType.RSA };
        const encryptedVotes: EncryptedVotes = await encryptVotes(votes, encryptionKeyRSA, EncryptionType.RSA);
        const decryptedVotes: Array<Vote> = await decryptVotes(encryptedVotes, decryptionKeyRSA, EncryptionType.RSA);

        expect(decryptedVotes).toEqual(votes);
        expect(encryptedVotes.hexString).toHaveLength(514) // RSA 2048 with '0x' prefix
        expect(encryptedVotes.encryptionType).toBe(EncryptionType.RSA);
    });

    it('should encrypt and then decrypt 95 votes back to original', async () => {
        const votingModule = await import("./voting");
        const { encryptVotes, decryptVotes } = votingModule;
        const keyGenerationModule = await import("../admin/generateRSAKeys");
        const { generateKeyPair } = keyGenerationModule;

        // Generating 95 votes ('Yes', 'No', and 'Abstain')
        const votes = Array.from({ length: 31 }, () => ({ value: VoteOption.Yes }))
            .concat(Array.from({ length: 32 }, () => ({ value: VoteOption.No })))
            .concat(Array.from({ length: 32 }, () => ({ value: VoteOption.Abstain })));

        const keyPair = await generateKeyPair();
        const encryptionKeyRSA: EncryptionKey = { hexString: keyPair.publicKey, encryptionType: EncryptionType.RSA };
        const decryptionKeyRSA: EncryptionKey = { hexString: keyPair.privateKey, encryptionType: EncryptionType.RSA };
        const encryptedVotes: EncryptedVotes = await encryptVotes(votes, encryptionKeyRSA, EncryptionType.RSA);
        const decryptedVotes: Array<Vote> = await decryptVotes(encryptedVotes, decryptionKeyRSA, EncryptionType.RSA);

        expect(decryptedVotes).toEqual(votes);
        expect(encryptedVotes.hexString).toHaveLength(514) // RSA 2048 with '0x' prefix
        expect(encryptedVotes.encryptionType).toBe(EncryptionType.RSA);
    });
});

describe('RSA: Edge Cases for Encryption and Decryption', () => {
    let generateKeyPair: () => Promise<{ publicKey: string; privateKey: string; }>;

    beforeAll(async () => {
        const keyGenerationModule = await import("../admin/generateRSAKeys");
        generateKeyPair = keyGenerationModule.generateKeyPair;
    });



    it('RSA: should throw an error when trying to encrypt an empty vote array', async () => {
        const { encryptVotes } = await import("./voting");
        const keyPair = await generateKeyPair();
        const encryptionKeyRSA: EncryptionKey = { hexString: keyPair.publicKey, encryptionType: EncryptionType.RSA };
        await expect(encryptVotes([], encryptionKeyRSA, EncryptionType.RSA)).rejects.toThrow("Encryption error: No votes provided.");
    });

    it('should throw an error when trying to encrypt one vote', async () => {
        const { encryptVotes } = await import("./voting");
        const keyPair = await generateKeyPair();
        const encryptionKeyRSA: EncryptionKey = { hexString: keyPair.publicKey, encryptionType: EncryptionType.RSA };
        await expect(encryptVotes([{ value: VoteOption.Yes }], encryptionKeyRSA, EncryptionType.RSA)).rejects.toThrow("Failed to encrypt votes: Message too short. Minimum length is 2 bytes, but got 1 bytes.");
    });


    it('should throw an error if encrypted data is incorrectly formatted', async () => {
        const { decryptVotes } = await import("./voting");
        const keyPair = await generateKeyPair();

        const decryptionKeyRSA: EncryptionKey = { hexString: keyPair.privateKey, encryptionType: EncryptionType.RSA };

        const invalidEncryptedVotes = { hexString: '12345', encryptionType: EncryptionType.RSA }; // Missing '0x' prefix
        await expect(decryptVotes(invalidEncryptedVotes, decryptionKeyRSA, EncryptionType.RSA)).rejects.toThrow("Decryption error: No valid encrypted data provided.");

        const emptyHexString = { hexString: '0x', encryptionType: EncryptionType.RSA }; // No data
        await expect(decryptVotes(emptyHexString, decryptionKeyRSA, EncryptionType.RSA)).rejects.toThrow("Decryption error: No valid encrypted data provided.");

        const missingHexString = { hexString: '', encryptionType: EncryptionType.RSA }; // Empty string
        await expect(decryptVotes(missingHexString, decryptionKeyRSA, EncryptionType.RSA)).rejects.toThrow("Decryption error: No valid encrypted data provided.");

    });

    it('should fail to decrypt with a wrong private key', async () => {
        const { encryptVotes, decryptVotes } = await import("./voting");

        const encryptionKeyPair = await generateKeyPair();
        const decryptionKeyPair = await generateKeyPair();

        const encryptionKeyRSA: EncryptionKey = { hexString: encryptionKeyPair.publicKey, encryptionType: EncryptionType.RSA };
        const decryptionKeyRSA: EncryptionKey = { hexString: decryptionKeyPair.privateKey, encryptionType: EncryptionType.RSA };

        expect(encryptionKeyPair.publicKey).not.toBe(decryptionKeyPair.publicKey);
        expect(encryptionKeyPair.privateKey).not.toBe(decryptionKeyPair.privateKey);

        const votes: Array<Vote> = [{ value: VoteOption.Yes }, { value: VoteOption.No }];
        const encryptedVotes: EncryptedVotes = await encryptVotes(votes, encryptionKeyRSA, EncryptionType.RSA);

        expect(encryptedVotes.hexString).toHaveLength(514) // RSA 2048 with '0x' prefix
        await expect(decryptVotes(encryptedVotes, decryptionKeyRSA, EncryptionType.RSA)).rejects.toThrow();

    });
});

describe('AES: Edge Cases for Encryption and Decryption', () => {

    beforeAll(async () => {
    });

    it('should throw an error when trying to encrypt an empty vote array', async () => {
        const { encryptVotes } = await import("./voting");
        const encryptionKey: EncryptionKey = { hexString: ethers.sha256("0x"), encryptionType: EncryptionType.AES };
        await expect(encryptVotes([], encryptionKey, EncryptionType.AES)).rejects.toThrow("Failed to encrypt votes: AES: Message cannot be empty.");
    });



    it('should throw an error if encrypted data is incorrectly formatted', async () => {
        const { decryptVotes } = await import("./voting");
        const encryptionKey: EncryptionKey = { hexString: ethers.sha256("0x"), encryptionType: EncryptionType.AES };

        const invalidEncryptedVotes = { hexString: '12345', encryptionType: EncryptionType.AES }; // Failed format check
        await expect(decryptVotes(invalidEncryptedVotes, encryptionKey, EncryptionType.AES)).rejects.toThrow("Failed to decrypt votes: Invalid token format. Token: 12345");

        const emptyHexString = { hexString: '0x', encryptionType: EncryptionType.AES }; // No data
        await expect(decryptVotes(emptyHexString, encryptionKey, EncryptionType.AES)).rejects.toThrow("Failed to decrypt votes: Invalid token format. Token: 0x");

        const missingHexString = { hexString: '', encryptionType: EncryptionType.AES }; // Empty string
        await expect(decryptVotes(missingHexString, encryptionKey, EncryptionType.AES)).rejects.toThrow("Failed to decrypt votes: Invalid token format. Token: ");


    });

    it('should fail to decrypt with a wrong private key', async () => {
        const { encryptVotes, decryptVotes } = await import("./voting");

        const encryptionKey: EncryptionKey = { hexString: ethers.sha256("0x"), encryptionType: EncryptionType.AES };
        const decryptionKey: EncryptionKey = { hexString: ethers.sha256("0x11"), encryptionType: EncryptionType.AES };

        expect(encryptionKey.hexString).not.toBe(decryptionKey.hexString);

        const votes: Array<Vote> = [{ value: VoteOption.Yes }, { value: VoteOption.No }];
        const encryptedVotes: EncryptedVotes = await encryptVotes(votes, encryptionKey, EncryptionType.AES);
        await expect(decryptVotes(encryptedVotes, decryptionKey, EncryptionType.AES)).rejects.toThrow();

    });
});

describe('createVotingTransactionWithoutSVSSignature', () => {
    it('should create a transaction with the correct properties', () => {
        const voterWallet: ethers.Wallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey)
        const dummyToken: Token = { hexString: "0x" + BigInt(3).toString(16).padStart(64, '0'), isMaster: false, isBlinded: false }
        const dummySignature: Signature = { hexString: '0x' + '1'.repeat((RSA_BIT_LENGTH / 4)), isBlinded: false }
        const dummyEncryptionKey: EncryptionKey = { hexString: '0x' + '1'.repeat(64), encryptionType: EncryptionType.AES }

        const voterCredentials: ElectionCredentials = {
            electionID: 1,
            voterWallet: voterWallet,
            unblindedElectionToken: dummyToken,
            unblindedSignature: dummySignature,
            encryptionKey: dummyEncryptionKey
        };
        const dummyEncryptedVotesRSA: EncryptedVotes = { hexString: '0x' + '1'.repeat((RSA_BIT_LENGTH / 4)), encryptionType: EncryptionType.RSA };
        const dummyEncryptedVotesAES: EncryptedVotes = { hexString: '0x' + '1'.repeat(80), encryptionType: EncryptionType.AES };

        const transaction: VotingTransaction = createVotingTransactionWithoutSVSSignature(voterCredentials, dummyEncryptedVotesRSA, dummyEncryptedVotesAES);

        expect(transaction.electionID).toBe(voterCredentials.electionID);
        expect(transaction.voterAddress).toBe(voterCredentials.voterWallet.address);
        expect(transaction.encryptedVoteRSA).toBe(dummyEncryptedVotesRSA);
        expect(transaction.encryptedVoteAES).toBe(dummyEncryptedVotesAES);
        expect(transaction.unblindedElectionToken).toBe(voterCredentials.unblindedElectionToken);
        expect(transaction.unblindedSignature).toBe(voterCredentials.unblindedSignature);
        expect(transaction.svsSignature).toBeNull();
    });
});


describe('addSVSSignatureToVotingTransaction', () => {
    it('should add an SVS signature correctly', () => {
        const dummyToken: Token = { hexString: "0x" + BigInt(3).toString(16).padStart(64, '0'), isMaster: false, isBlinded: false }
        const dummySignature: Signature = { hexString: '0x' + '1'.repeat((RSA_BIT_LENGTH / 4)), isBlinded: false }
        const dummyEncryptedVotesRSA: EncryptedVotes = { hexString: '0x' + '1'.repeat((RSA_BIT_LENGTH / 4)), encryptionType: EncryptionType.RSA };
        const dummyEncryptedVotesAES: EncryptedVotes = { hexString: '0x' + '1'.repeat(80), encryptionType: EncryptionType.AES };

        const transaction: VotingTransaction = {
            electionID: 1,
            voterAddress: '0x0000000000000000000000000000000000000000',
            encryptedVoteRSA: dummyEncryptedVotesRSA,
            encryptedVoteAES: dummyEncryptedVotesAES,
            unblindedElectionToken: dummyToken,
            unblindedSignature: dummySignature,
            svsSignature: null
        };

        const svsSignature: EthSignature = { hexString: '0xa106c04b7ac65cabdaaa73a7ac6a7c506218495345706e2a7aa10eb5ff391ccc2cb7ceabfdc3256ed7565cc88717bf4b581acdba44f38134696b700cda41358f1c' }; //dummy signature
        const updatedTransaction: VotingTransaction = addSVSSignatureToVotingTransaction(transaction, svsSignature);

        expect(updatedTransaction.svsSignature).toBe(svsSignature);
    });

    it('should throw if SVS signature is already present', () => {
        const dummyToken: Token = { hexString: "0x" + BigInt(3).toString(16).padStart(64, '0'), isMaster: false, isBlinded: false }
        const dummySignature: Signature = { hexString: '0x' + '1'.repeat((RSA_BIT_LENGTH / 4)), isBlinded: false }
        const dummyEncryptedVotesRSA: EncryptedVotes = { hexString: '0x' + '1'.repeat((RSA_BIT_LENGTH / 4)), encryptionType: EncryptionType.RSA };
        const dummyEncryptedVotesAES: EncryptedVotes = { hexString: '0x' + '1'.repeat(80), encryptionType: EncryptionType.AES };
        const svsSignature: EthSignature = { hexString: '0x' + '1'.repeat(130) };

        const transaction: VotingTransaction = {
            electionID: 1,
            voterAddress: '0x0000000000000000000000000000000000000000',
            encryptedVoteRSA: dummyEncryptedVotesRSA,
            encryptedVoteAES: dummyEncryptedVotesAES,
            unblindedElectionToken: dummyToken,
            unblindedSignature: dummySignature,
            svsSignature: dummySignature
        };
        expect(() => addSVSSignatureToVotingTransaction(transaction, svsSignature)).toThrow('Voting Transaction already contains SVS Signature');
    });

});

