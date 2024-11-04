import { Request, Response } from 'express';
import { checkForExistingSVSSignature } from './checkForExistingSVSSignature';
import { dataSource } from '../database';
import { EthSignature, VotingTransaction, Token } from 'votingsystem';
import { logger } from '../utils/logger';

jest.mock('../database');
jest.mock('../models/VotingTransaction');

describe('checkForExistingSVSSignature Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let nextFunction: jest.Mock;
    let mockRepository: any;

    beforeEach(() => {
        mockReq = {
            body: {}
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        nextFunction = jest.fn();
        mockRepository = {
            findOne: jest.fn(),
        };
        (dataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);
        (logger.error as jest.Mock) = jest.fn();
        (logger.info as jest.Mock) = jest.fn();
        (logger.warn as jest.Mock) = jest.fn();
    });

    it('should return 200 with existing signature if found', async () => {
        const mockVotingTransaction: VotingTransaction = {
            electionID: 1,
            voterAddress: '0x1234567890123456789012345678901234567890',
            encryptedVote: { hexString: '0x1234' },
            unblindedElectionToken: { hexString: '0xabcd' } as Token,
            unblindedSignature: {
                hexString: '0xef01',
                isBlinded: false
            },
            svsSignature: null
        };
        const mockVoterSignature: EthSignature = { hexString: '0x2345' };
        mockReq.body = { votingTransaction: mockVotingTransaction, voterSignature: mockVoterSignature };

        // Mock constant signature to pass validateEthSignature(ethSignature)
        const mockExistingTransaction = {
            svsSignature: "0xd4810d1ba4c299209b9b98c5623efdcbff269bb91d40247355e81ae087c32fb55ce42815ff163f61589886233542b4b95a65fb7d4235cc827e7a09e4d97e3f3f1b"
        };
        mockRepository.findOne.mockResolvedValue(mockExistingTransaction);

        await checkForExistingSVSSignature(mockReq as Request, mockRes as Response, nextFunction);

        // Mock constant signature to pass validateEthSignature(ethSignature)
        const mockResBlindedSignature: EthSignature = {
            hexString: '0xd4810d1ba4c299209b9b98c5623efdcbff269bb91d40247355e81ae087c32fb55ce42815ff163f61589886233542b4b95a65fb7d4235cc827e7a09e4d97e3f3f1b',
        };

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: {
                message: 'Existing SVS signature found.',
                blindedSignature: mockResBlindedSignature,
            },
            error: null
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should call next() if no existing signature is found', async () => {
        const mockVotingTransaction: VotingTransaction = {
            electionID: 1,
            voterAddress: '0x1234567890123456789012345678901234567890',
            encryptedVote: { hexString: '0x1234' },
            unblindedElectionToken: { hexString: '0xabcd' } as Token,
            unblindedSignature: {
                hexString: '0xef01',
                isBlinded: false
            },
            svsSignature: null
        };
        const mockVoterSignature: EthSignature = { hexString: '0x2345' };
        mockReq.body = { votingTransaction: mockVotingTransaction, voterSignature: mockVoterSignature };

        mockRepository.findOne.mockResolvedValue(null);

        await checkForExistingSVSSignature(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).not.toHaveBeenCalled();
        expect(mockRes.json).not.toHaveBeenCalled();
        expect(nextFunction).toHaveBeenCalled();
    });

    it('should return 500 if there is a database error', async () => {
        const mockVotingTransaction: VotingTransaction = {
            electionID: 1,
            voterAddress: '0x1234567890123456789012345678901234567890',
            encryptedVote: { hexString: '0x1234' },
            unblindedElectionToken: { hexString: '0xabcd' } as Token,
            unblindedSignature: {
                hexString: '0xef01',
                isBlinded: false
            },
            svsSignature: null
        };
        const mockVoterSignature: EthSignature = { hexString: '0x2345' };
        mockReq.body = { votingTransaction: mockVotingTransaction, voterSignature: mockVoterSignature };

        const dbError = new Error('Database error');
        mockRepository.findOne.mockRejectedValue(dbError);

        await checkForExistingSVSSignature(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Internal server error',
        });
        expect(nextFunction).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith('Database error:', dbError);

    });
});