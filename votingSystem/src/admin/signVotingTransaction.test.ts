import { ethers } from 'ethers';
import { signVotingTransaction } from './signVotingTransaction';
import { createVotingTransactionWithoutSVSSignature } from '../voting/voting';
import { ElectionCredentials, EncryptedVotes, EthSignature, Signature, Token, VotingTransaction } from '../types/types';
import { isValidHex } from '../utils/utils';
import * as utils from '../utils/utils';
import { RSA_BIT_LENGTH } from '../utils/constants';

describe('signVotingTransaction', () => {
    let voterWallet: ethers.Wallet;
    let dummyToken: Token;
    let dummySignature: Signature;
    let voterCredentials: ElectionCredentials;
    let dummyEncryptedVotes: EncryptedVotes;

    beforeEach(() => {
        const expectedHexLength = (RSA_BIT_LENGTH / 4) + 2; // RSA_BIT_LENGTH bits => RSA_BIT_LENGTH / 4 hex characters + 2 for '0x' prefix

        voterWallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey);
        dummyToken = { hexString: "0x" + BigInt(3).toString(16).padStart(64, '0'), isMaster: false, isBlinded: false };
        dummySignature = { hexString: '0x' + '1'.repeat(expectedHexLength - 2), isBlinded: false };
        voterCredentials = {
            electionID: 1,
            voterWallet: voterWallet,
            unblindedElectionToken: dummyToken,
            unblindedSignature: dummySignature
        };
        dummyEncryptedVotes = { hexString: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' };
    });

    it('should sign a voting transaction successfully', async () => {
        const votingTransaction = createVotingTransactionWithoutSVSSignature(voterCredentials, dummyEncryptedVotes);

        const signature: EthSignature = await signVotingTransaction(votingTransaction, voterWallet.privateKey);

        expect(signature).toBeDefined();
        expect(isValidHex(signature.hexString)).toBe(true);
    });

    it('should throw an error if SVS Signature is already set', async () => {
        const votingTransaction = createVotingTransactionWithoutSVSSignature(voterCredentials, dummyEncryptedVotes);
        votingTransaction.svsSignature = dummySignature;

        await expect(signVotingTransaction(votingTransaction, voterWallet.privateKey))
            .rejects
            .toThrow("SVS Signature already set");
    });

    it('should throw an error if the signing key is invalid', async () => {
        const votingTransaction = createVotingTransactionWithoutSVSSignature(voterCredentials, dummyEncryptedVotes);
        await expect(signVotingTransaction(votingTransaction, "invalid_private_key"))
            .rejects
            .toThrow("Error creating ethers Wallet");
    });

    it('should throw an error if the voting transaction is invalid', async () => {
        const invalidVotingTransaction = createVotingTransactionWithoutSVSSignature(voterCredentials, dummyEncryptedVotes);
        // Voting transaction is not allowed to hold Master Token
        invalidVotingTransaction.unblindedElectionToken.isMaster = true;

        await expect(signVotingTransaction(invalidVotingTransaction, voterWallet.privateKey))
            .rejects
            .toThrow("Voting transaction must not include a Master Token.");
    });

    it('should throw an error if there is an error during signing', async () => {
        const votingTransaction = createVotingTransactionWithoutSVSSignature(voterCredentials, dummyEncryptedVotes);
        votingTransaction.encryptedVote.hexString = "invalid_hex_string";

        // Mock the validateVotingTransaction function to be a no-op
        jest.spyOn(utils, 'validateVotingTransaction').mockImplementation(() => { });


        await expect(signVotingTransaction(votingTransaction, voterWallet.privateKey))
            .rejects
            .toThrow("Error signing voting transaction:");

    });

});
