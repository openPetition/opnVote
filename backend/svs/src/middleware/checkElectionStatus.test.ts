import { Request, Response } from 'express';
import { ElectionService } from '../services/electionService';
import { checkElectionStatus } from './checkElectionStatus';
import { EthSignature, VotingTransaction } from 'votingsystem';

jest.mock('../services/electionService', () => ({
    ElectionService: {
        getElectionStatus: jest.fn(),
        isElectionClosed: jest.fn(),
    },
}));



describe('checkElectionStatus Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let nextFunction: jest.Mock;

    beforeEach(() => {
        mockReq = {
            body: {
                votingTransaction: {
                    electionID: 1,
                    voterAddress: "0x123",
                    encryptedVoteRSA: {} as any,
                    encryptedVoteAES: {} as any,
                    unblindedElectionToken: {} as any,
                    unblindedSignature: {} as any,
                    svsSignature: null,
                } as VotingTransaction,
                voterSignature: {
                    hexString: "0x456",
                } as EthSignature,
            },
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        nextFunction = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should call next if isElectionClosed returns false', async () => {
        (ElectionService.getElectionStatus as jest.Mock).mockResolvedValue({
            status: 1,
            endTime: String(Date.now() / 1000 + 3600), // Future end time
        });
        (ElectionService.isElectionClosed as jest.Mock).mockReturnValue(false);

        await checkElectionStatus(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 403 if isElectionClosed returns true', async () => {
        (ElectionService.getElectionStatus as jest.Mock).mockResolvedValue({
            status: 2,
            endTime: String(Date.now() / 1000 - 3600), // Past end time
        });
        (ElectionService.isElectionClosed as jest.Mock).mockReturnValue(true);

        await checkElectionStatus(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
            error: 'Election is closed',
        });
    });

    it('should return 500 if there is an error during processing', async () => {
        mockReq.body.votingTransaction.electionID = -1;

        await checkElectionStatus(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            error: 'Failed to check election status',
        });
    });


});
