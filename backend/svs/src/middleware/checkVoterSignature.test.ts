import { Request, Response, NextFunction } from 'express';
import { checkVoterSignature } from './checkVoterSignature';
import { VotingTransaction, validateEthSignature } from 'votingsystem';
import { ethers } from 'ethers';



describe('checkVoterSignature Middleware', () => {
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
        await checkVoterSignature(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Unauthorized or missing Voter Signature'
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 if the signature is invalid', async () => {

        const voterWallet = ethers.Wallet.createRandom()
        const voterWalletWrong = ethers.Wallet.createRandom()

        const votingTransaction: VotingTransaction = {
            electionID: 1,
            voterAddress: voterWallet.address,
            encryptedVote: {} as any,
            unblindedElectionToken: {} as any,
            unblindedSignature: {} as any,
            svsSignature: null
        };

        const voterSignature = {
            hexString: await voterWalletWrong.signMessage(JSON.stringify(votingTransaction))
        };

        mockReq.body = { votingTransaction, voterSignature };


        await checkVoterSignature(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Invalid Voter signature'
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next if the signature is valid', async () => {
        const voterWallet = ethers.Wallet.createRandom()
        const votingTransaction: VotingTransaction = {
            electionID: 1,
            voterAddress: voterWallet.address,
            encryptedVote: {} as any,
            unblindedElectionToken: {} as any,
            unblindedSignature: {} as any,
            svsSignature: null
        };
        const message = JSON.stringify(votingTransaction);
        const messageHash = ethers.hashMessage(message);
        const voterSignature = {
            hexString: await voterWallet.signMessage(messageHash)
        };


        mockReq.body = { votingTransaction, voterSignature };


        await checkVoterSignature(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).not.toHaveBeenCalled();
        expect(mockRes.json).not.toHaveBeenCalled();
        expect(nextFunction).toHaveBeenCalled();
    });

    it('should return 500 if there is an error during processing', async () => {
        const voterWallet = ethers.Wallet.createRandom()
        const votingTransaction: VotingTransaction = {
            electionID: 1,
            voterAddress: voterWallet.address,
            encryptedVote: {} as any,
            unblindedElectionToken: {} as any,
            unblindedSignature: {} as any,
            svsSignature: null
        };

        const voterSignature = {
            hexString: "0x0"
        };


        mockReq.body = { votingTransaction, voterSignature };


        await checkVoterSignature(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            error: 'Failed to validate Voter Signature',
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });
});
