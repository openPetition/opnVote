import { Request, Response } from 'express';
import { checkVoterHasNotVoted } from './checkVoterHasNotVoted';
import { dataSource } from '../database';
import { VotingTransaction } from 'votingsystem';
import { VotingTransactionEntity } from '../models/VotingTransaction';
import { logger } from '../utils/logger';


describe('checkVoterHasNotVoted Middleware', () => {
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
            findOne: jest.fn()
        };
        (dataSource.getRepository as jest.Mock) = jest.fn().mockReturnValue(mockRepository);
        (logger.error as jest.Mock) = jest.fn();
        (logger.info as jest.Mock) = jest.fn();
        (logger.warn as jest.Mock) = jest.fn();
    });

    it('should call next if voter has not voted', async () => {
        const votingTransaction: VotingTransaction = {
            electionID: 1,
            voterAddress: '0x1234567890123456789012345678901234567890',
            encryptedVote: {} as any,
            unblindedElectionToken: {} as any,
            unblindedSignature: {} as any,
            svsSignature: null
        };

        mockReq.body = { votingTransaction };
        mockRepository.findOne.mockResolvedValueOnce(null);

        await checkVoterHasNotVoted(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
        expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should return 400 if voter has already voted', async () => {
        const votingTransaction: VotingTransaction = {
            electionID: 1,
            voterAddress: '0x1234567890123456789012345678901234567890',
            encryptedVote: {} as any,
            unblindedElectionToken: {} as any,
            unblindedSignature: {} as any,
            svsSignature: null
        };

        mockReq.body = { votingTransaction };
        mockRepository.findOne.mockResolvedValueOnce(new VotingTransactionEntity());

        await checkVoterHasNotVoted(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Voter has already submitted a transaction for this election'
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 500 if there is a database error', async () => {
        const votingTransaction: VotingTransaction = {
            electionID: 1,
            voterAddress: '0x1234567890123456789012345678901234567890',
            encryptedVote: {} as any,
            unblindedElectionToken: {} as any,
            unblindedSignature: {} as any,
            svsSignature: null,
        };
        mockReq.body = { votingTransaction };
        const dbError = new Error('Database error');
        mockRepository.findOne.mockRejectedValue(dbError);

        await checkVoterHasNotVoted(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Internal server error',
        });
        expect(logger.error).toHaveBeenCalledWith('Database error:', dbError);
    });


    it('should normalize the voter address', async () => {
        const votingTransaction: VotingTransaction = {
            electionID: 1,
            voterAddress: '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
            encryptedVote: {} as any,
            unblindedElectionToken: {} as any,
            unblindedSignature: {} as any,
            svsSignature: null,
        };
        mockReq.body = { votingTransaction };
        mockRepository.findOne.mockResolvedValue(null);

        await checkVoterHasNotVoted(mockReq as Request, mockRes as Response, nextFunction);
        expect(mockRepository.findOne).toHaveBeenCalledWith({
            where: {
                electionID: 1,
                voterAddress: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
            },
        });
        expect(nextFunction).toHaveBeenCalled();
    });

}); 