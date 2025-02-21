import { Request, Response } from 'express';
import { validateParameters } from './validateParameters';
import { RSA_BIT_LENGTH, EncryptedVotes, EthSignature, Signature, Token, VotingTransaction, EncryptionType } from 'votingsystem';
import { ethers } from 'ethers';

describe('validateParameters Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let nextFunction: jest.Mock;

    beforeEach(() => {
        mockReq = {
            body: {}
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        nextFunction = jest.fn();
    });

    it('should return 401 if votingTransaction or voterSignature is missing', async () => {
        await validateParameters(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Unauthorized or missing Voter Signature'
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if svsSignature is already set', async () => {
        const voterWallet = ethers.Wallet.createRandom();
        const svsSignature: EthSignature = {
            hexString: await voterWallet.signMessage("randomMock")
        };

        const dummyToken: Token = { hexString: "0x" + BigInt(3).toString(16).padStart(64, '0'), isMaster: false, isBlinded: false }
        const dummySignature: Signature = { hexString: '0x' + '1'.repeat((RSA_BIT_LENGTH / 4)), isBlinded: false }
        const dummyEncryptedVotesRSA: EncryptedVotes = { hexString: '0x' + '1'.repeat((RSA_BIT_LENGTH / 4)), encryptionType: EncryptionType.RSA };
        const dummyEncryptedVotesAES: EncryptedVotes = { hexString: '0x' + '1'.repeat(80), encryptionType: EncryptionType.AES };

        const votingTransaction: VotingTransaction = {
            electionID: 1,
            voterAddress: voterWallet.address,
            encryptedVoteRSA: dummyEncryptedVotesRSA,
            encryptedVoteAES: dummyEncryptedVotesAES,
            unblindedElectionToken: dummyToken,
            unblindedSignature: dummySignature,
            svsSignature: svsSignature
        };

        const voterSignature: EthSignature = {
            hexString: await voterWallet.signMessage(JSON.stringify(votingTransaction))
        };

        mockReq.body = { votingTransaction, voterSignature };

        await validateParameters(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'SVS Signature is already set!'
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next if all parameters are set correctly', async () => {
        const voterWallet = ethers.Wallet.createRandom();


        const dummyToken: Token = { hexString: "0x" + BigInt(3).toString(16).padStart(64, '0'), isMaster: false, isBlinded: false }
        const dummySignature: Signature = { hexString: '0x' + '1'.repeat((RSA_BIT_LENGTH / 4)), isBlinded: false }
        const dummyEncryptedVotesRSA: EncryptedVotes = { hexString: '0x' + '1'.repeat((RSA_BIT_LENGTH / 4)), encryptionType: EncryptionType.RSA };
        const dummyEncryptedVotesAES: EncryptedVotes = { hexString: '0x' + '1'.repeat(80), encryptionType: EncryptionType.AES };

        const votingTransaction: VotingTransaction = {
            electionID: 1,
            voterAddress: voterWallet.address,
            encryptedVoteRSA: dummyEncryptedVotesRSA,
            encryptedVoteAES: dummyEncryptedVotesAES,
            unblindedElectionToken: dummyToken,
            unblindedSignature: dummySignature,
            svsSignature: null
        };

        const voterSignature: EthSignature = {
            hexString: await voterWallet.signMessage(JSON.stringify(votingTransaction))
        };

        mockReq.body = { votingTransaction, voterSignature };

        await validateParameters(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).not.toHaveBeenCalled();
        expect(mockRes.json).not.toHaveBeenCalled();
        expect(nextFunction).toHaveBeenCalled();
    });

    it('should return 500 if there is an error during processing', async () => {
        const voterWallet = ethers.Wallet.createRandom();
        const dummyToken: Token = { hexString: "0x" + BigInt(3).toString(16).padStart(64, '0'), isMaster: false, isBlinded: false }
        const dummySignature: Signature = { hexString: '0x' + '1'.repeat((RSA_BIT_LENGTH / 4)), isBlinded: false }
        const dummyEncryptedVotesRSA: EncryptedVotes = { hexString: '0x' + '1'.repeat((RSA_BIT_LENGTH / 4)), encryptionType: EncryptionType.RSA };
        const dummyEncryptedVotesAES: EncryptedVotes = { hexString: '0x' + '1'.repeat(80), encryptionType: EncryptionType.AES };

        const votingTransaction: VotingTransaction = {
            electionID: 1,
            voterAddress: voterWallet.address,
            encryptedVoteRSA: dummyEncryptedVotesRSA,
            encryptedVoteAES: dummyEncryptedVotesAES,
            unblindedElectionToken: dummyToken,
            unblindedSignature: dummySignature,
            svsSignature: null
        };

        const voterSignature: EthSignature = {
            hexString: "0x0" // Invalid signature
        };

        mockReq.body = { votingTransaction, voterSignature };

        await validateParameters(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            error: 'Failed to validate Voter Signature',
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });
});
