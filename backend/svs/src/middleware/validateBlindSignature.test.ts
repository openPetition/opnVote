import dotenv from 'dotenv';
dotenv.config();

import { Request, Response } from 'express';
import { validateBlindSignature } from './validateBlindSignature';
import { ElectionService } from '../services/electionService';
import { RSA_BIT_LENGTH, EncryptedVotes, EthSignature, RSAParams, Signature, TestRegister, Token, VotingTransaction, blindToken, deriveElectionR, deriveElectionUnblindedToken, generateKeyPairRaw, generateMasterTokenAndMasterR, signToken, unblindSignature } from 'votingsystem';
import { ethers } from 'ethers';

jest.mock('../services/electionService');

describe('validateBlindSignature Middleware', () => {
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

    it('should return 500 if ElectionStatusService.getElectionRegisterPublicKey returns null', async () => {
        const voterWallet = ethers.Wallet.createRandom();
        const svsSignature: EthSignature = {
            hexString: await voterWallet.signMessage("randomMock")
        };

        const dummyToken: Token = { hexString: "0x" + BigInt(3).toString(16).padStart(64, '0'), isMaster: false, isBlinded: false }
        const dummySignature: Signature = { hexString: '0x' + '1'.repeat((RSA_BIT_LENGTH / 4)), isBlinded: false }
        const dummyEncryptedVotes: EncryptedVotes = { hexString: '0x' + '1'.repeat((RSA_BIT_LENGTH / 4)) };

        const votingTransaction: VotingTransaction = {
            electionID: 1,
            voterAddress: voterWallet.address,
            encryptedVote: dummyEncryptedVotes,
            unblindedElectionToken: dummyToken,
            unblindedSignature: dummySignature,
            svsSignature: svsSignature
        };

        const voterSignature: EthSignature = {
            hexString: await voterWallet.signMessage(JSON.stringify(votingTransaction))
        };

        mockReq.body = { votingTransaction, voterSignature };

        (ElectionService.getElectionRegisterPublicKey as jest.Mock).mockResolvedValue(null);
        await validateBlindSignature(mockReq as Request, mockRes as Response, nextFunction);
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            error: `Could not retrieve Register Public Key for Election ${votingTransaction.electionID}. Please try again later.`,
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 500 if verifyUnblindedSignature throws an error', async () => {


        const voterWallet = ethers.Wallet.createRandom();
        const svsSignature: EthSignature = {
            hexString: await voterWallet.signMessage("randomMock")
        };

        const dummyToken: Token = { hexString: "0x" + BigInt(3).toString(16).padStart(64, '0'), isMaster: false, isBlinded: false }
        const dummySignature: Signature = { hexString: '0x' + '1'.repeat((RSA_BIT_LENGTH / 4)), isBlinded: false }
        const dummyEncryptedVotes: EncryptedVotes = { hexString: '0x' + '1'.repeat((RSA_BIT_LENGTH / 4)) };

        const votingTransaction: VotingTransaction = {
            electionID: 1,
            voterAddress: voterWallet.address,
            encryptedVote: dummyEncryptedVotes,
            unblindedElectionToken: dummyToken,
            unblindedSignature: dummySignature,
            svsSignature: svsSignature
        };

        const voterSignature: EthSignature = {
            hexString: await voterWallet.signMessage(JSON.stringify(votingTransaction))
        };

        mockReq.body = { votingTransaction, voterSignature };

        (ElectionService.getElectionRegisterPublicKey as jest.Mock).mockResolvedValue('publicKey');
        jest.mock('votingsystem', () => {
            const actualModule = jest.requireActual('votingsystem');
            return {
                ...actualModule,
                verifyUnblindedSignature: jest.fn(() => { throw new Error('Test Error'); })
            };
        });

        await validateBlindSignature(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            error: 'Failed to validate Blind Signature',
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next if verifyUnblindedSignature returns true', async () => {
        const generatedTokens = generateMasterTokenAndMasterR();
        const masterToken = generatedTokens.masterToken;
        const masterR = generatedTokens.masterR;

        const electionID = 1
        const unblindedElectionToken = deriveElectionUnblindedToken(electionID, masterToken);
        const unblindedElectionR = deriveElectionR(electionID, masterR, unblindedElectionToken, TestRegister)

        const blindedElectionToken = blindToken(unblindedElectionToken, unblindedElectionR, TestRegister)

        const blindedSignature = signToken(blindedElectionToken, TestRegister)
        const unblindedSignature = unblindSignature(blindedSignature, unblindedElectionR, TestRegister)

        const voterWallet = ethers.Wallet.createRandom();
        const svsSignature: EthSignature = {
            hexString: await voterWallet.signMessage("randomMock")
        };
        const dummyEncryptedVotes: EncryptedVotes = { hexString: '0x' + '1'.repeat((RSA_BIT_LENGTH / 4)) };

        const votingTransaction: VotingTransaction = {
            electionID: 1,
            voterAddress: voterWallet.address,
            encryptedVote: dummyEncryptedVotes,
            unblindedElectionToken: unblindedElectionToken,
            unblindedSignature: unblindedSignature,
            svsSignature: svsSignature
        };


        const voterSignature: EthSignature = {
            hexString: await voterWallet.signMessage(JSON.stringify(votingTransaction))
        };

        mockReq.body = { votingTransaction, voterSignature };


        (ElectionService.getElectionRegisterPublicKey as jest.Mock).mockResolvedValue(TestRegister);
        await validateBlindSignature(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
        expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should return 401 if verifyUnblindedSignature returns false', async () => {
        const registerRSAParamsRaw = generateKeyPairRaw()
        expect(registerRSAParamsRaw.e).toBeDefined()
        const mockRSAParams: RSAParams = { N: BigInt(registerRSAParamsRaw.N), e: BigInt(registerRSAParamsRaw.e!), NbitLength: registerRSAParamsRaw.NbitLength }

        const generatedTokens = generateMasterTokenAndMasterR();
        const masterToken = generatedTokens.masterToken;
        const masterR = generatedTokens.masterR;

        const electionID = 1
        const unblindedElectionToken = deriveElectionUnblindedToken(electionID, masterToken);
        const unblindedElectionR = deriveElectionR(electionID, masterR, unblindedElectionToken, TestRegister)

        const blindedElectionToken = blindToken(unblindedElectionToken, unblindedElectionR, TestRegister)

        const blindedSignature = signToken(blindedElectionToken, TestRegister)
        const unblindedSignature = unblindSignature(blindedSignature, unblindedElectionR, TestRegister)

        const voterWallet = ethers.Wallet.createRandom();
        const svsSignature: EthSignature = {
            hexString: await voterWallet.signMessage("randomMock")
        };
        const dummyEncryptedVotes: EncryptedVotes = { hexString: '0x' + '1'.repeat((RSA_BIT_LENGTH / 4)) };

        const votingTransaction: VotingTransaction = {
            electionID: 1,
            voterAddress: voterWallet.address,
            encryptedVote: dummyEncryptedVotes,
            unblindedElectionToken: unblindedElectionToken,
            unblindedSignature: unblindedSignature,
            svsSignature: svsSignature
        };


        const voterSignature: EthSignature = {
            hexString: await voterWallet.signMessage(JSON.stringify(votingTransaction))
        };

        mockReq.body = { votingTransaction, voterSignature };

        (ElectionService.getElectionRegisterPublicKey as jest.Mock).mockResolvedValue(mockRSAParams);
        await validateBlindSignature(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Blinded Signature is not valid'
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });
});
