import { ElectionCredentials, EncryptedVotes, EthSignature, Signature, Token, Vote, VoteOption, VotingTransaction } from "../types/types";
import { ethers } from "ethers";
import { addSVSSignatureToVotingTransaction, createVotingTransactionWithoutSVSSignature } from "./voting";

describe('Encryption and Decryption Integration', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    it('should encrypt and then decrypt votes back to the original', async () => {
        const votingModule = await import("./voting");
        const { encryptVotes, decryptVotes } = votingModule;
        const keyGenerationModule = await import("../admin/generateRSAKeys");
        const { generateKeyPair } = keyGenerationModule;

        const votes: Array<Vote> = [{ value: VoteOption.Yes }, { value: VoteOption.No }];
        const keyPair = await generateKeyPair();
        const encryptedVotes: EncryptedVotes = await encryptVotes(votes, keyPair.publicKey);
        const decryptedVotes: Array<Vote> = await decryptVotes(encryptedVotes, keyPair.privateKey);
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

        const keyPair = await generateKeyPair();
        const encryptedVotes: EncryptedVotes = await encryptVotes(votes, keyPair.publicKey);
        const decryptedVotes: Array<Vote> = await decryptVotes(encryptedVotes, keyPair.privateKey);

        expect(decryptedVotes).toEqual(votes);
        expect(encryptedVotes.hexString).toHaveLength(514) // RSA 2048 with '0x' prefix

    });
});



describe('Edge Cases for Encryption and Decryption', () => {
    let generateKeyPair: () => Promise<{ publicKey: string; privateKey: string; }>;

    beforeAll(async () => {
        const keyGenerationModule = await import("../admin/generateRSAKeys");
        generateKeyPair = keyGenerationModule.generateKeyPair;
    });



    it('should throw an error when trying to encrypt an empty vote array', async () => {
        const { encryptVotes } = await import("./voting");
        const keyPair = await generateKeyPair();
        await expect(encryptVotes([], keyPair.publicKey)).rejects.toThrow("Encryption error: No votes provided.");
    });


    it('should throw an error if encrypted data is incorrectly formatted', async () => {
        const { decryptVotes } = await import("./voting");
        const keyPair = await generateKeyPair();

        const invalidEncryptedVotes = { hexString: '12345' }; // Missing '0x' prefix
        await expect(decryptVotes(invalidEncryptedVotes, keyPair.privateKey)).rejects.toThrow("Decryption error: No valid encrypted data provided.");

        const emptyHexString = { hexString: '0x' }; // No data
        await expect(decryptVotes(emptyHexString, keyPair.privateKey)).rejects.toThrow("Decryption error: No valid encrypted data provided.");

        const missingHexString = { hexString: '' }; // Empty string
        await expect(decryptVotes(missingHexString, keyPair.privateKey)).rejects.toThrow("Decryption error: No valid encrypted data provided.");
    });

    it('should fail to decrypt with a wrong private key', async () => {
        const { encryptVotes, decryptVotes } = await import("./voting");

        const encryptionKeyPair = await generateKeyPair();
        const decryptionKeyPair = await generateKeyPair();

        expect(encryptionKeyPair.publicKey).not.toBe(decryptionKeyPair.publicKey);
        expect(encryptionKeyPair.privateKey).not.toBe(decryptionKeyPair.privateKey);

        const votes: Array<Vote> = [{ value: VoteOption.Yes }, { value: VoteOption.No }];
        const encryptedVotes: EncryptedVotes = await encryptVotes(votes, encryptionKeyPair.publicKey);

        expect(encryptedVotes.hexString).toHaveLength(514) // RSA 2048 with '0x' prefix
        await expect(decryptVotes(encryptedVotes, decryptionKeyPair.privateKey)).rejects.toThrow();

    });
});

describe('createVotingTransactionWithoutSVSSignature', () => {
    it('should create a transaction with the correct properties', () => {
        const voterWallet: ethers.Wallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey)
        const dummyToken: Token = { hexString: "0x0000000000000000000000000000000000000000000000000000000000000000", isMaster: false, isBlinded: false }
        const dummySignature: Signature = { hexString: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", isBlinded: false }
        const voterCredentials: ElectionCredentials = {
            electionID: 1,
            voterWallet: voterWallet,
            unblindedElectionToken: dummyToken,
            unblindedSignature: dummySignature
        };
        const dummyEncryptedVotes: EncryptedVotes = { hexString: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' };

        const transaction: VotingTransaction = createVotingTransactionWithoutSVSSignature(voterCredentials, dummyEncryptedVotes);

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
        const dummyEncryptedVotes: EncryptedVotes = { hexString: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' };

        const transaction: VotingTransaction = {
            electionID: 1,
            voterAddress: '0x0000000000000000000000000000000000000000',
            encryptedVote: dummyEncryptedVotes,
            unblindedElectionToken: dummyToken,
            unblindedSignature: dummySignature,
            svsSignature: null
        };

        const svsSignature: EthSignature = { hexString: dummySignature.hexString };
        const updatedTransaction: VotingTransaction = addSVSSignatureToVotingTransaction(transaction, svsSignature);

        expect(updatedTransaction.svsSignature).toBe(svsSignature);
    });

    it('should throw if SVS signature is already present', () => {
        const dummyToken: Token = { hexString: "0x0000000000000000000000000000000000000000000000000000000000000000", isMaster: false, isBlinded: false }
        const dummySignature: Signature = { hexString: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", isBlinded: false }
        const dummyEncryptedVotes: EncryptedVotes = { hexString: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' };

        const transaction: VotingTransaction = {
            electionID: 1,
            voterAddress: '0x0000000000000000000000000000000000000000',
            encryptedVote: dummyEncryptedVotes,
            unblindedElectionToken: dummyToken,
            unblindedSignature: dummySignature,
            svsSignature: dummySignature
        };
        const svsSignature: EthSignature = { hexString: dummySignature.hexString };

        expect(() => addSVSSignatureToVotingTransaction(transaction, svsSignature)).toThrow('Voting Transaction already contains SVS Signature');
    });

});

