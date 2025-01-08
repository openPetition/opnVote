import { Request, Response } from 'express';
import { checkForwardLimit } from './checkForwardLimit';
import { dataSource } from '../database';
import { SignatureData } from '@gelatonetwork/relay-sdk';
import { ForwardedTransactionEntity } from '../models/ForwardedTransaction';

describe('checkForwardLimit Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let nextFunction: jest.Mock;
    const mockMaxForwards = 3;
    let mockQueryRunner: any;

    beforeEach(() => {
        mockReq = {
            body: {},
            app: {
                get: jest.fn().mockReturnValue(mockMaxForwards)
            } as any
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        nextFunction = jest.fn();

        mockQueryRunner = {
            connect: jest.fn(),
            startTransaction: jest.fn(),
            commitTransaction: jest.fn(),
            rollbackTransaction: jest.fn(),
            release: jest.fn(),
            manager: {
                getRepository: jest.fn().mockReturnValue({
                    findOne: jest.fn(),
                    save: jest.fn()
                })
            }
        };

        (dataSource.createQueryRunner as jest.Mock) = jest.fn().mockReturnValue(mockQueryRunner);
    });


    it('should pass when creating first forward request', async () => {
        const mockSignatureData = {
            struct: {
                user: '0x1234567890123456789012345678901234567890'
            },
            signature: '0x1234'
        } as SignatureData;

        mockReq.body = mockSignatureData;
        mockQueryRunner.manager.getRepository().findOne.mockResolvedValueOnce(null);

        await checkForwardLimit(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
        expect(mockQueryRunner.manager.getRepository().save).toHaveBeenCalled();
        expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
        expect(nextFunction).toHaveBeenCalled();
    });

    it('should pass when forward count is below limit', async () => {
        const mockSignatureData = {
            struct: {
                user: '0x1234567890123456789012345678901234567890'
            },
            signature: '0x1234'
        } as SignatureData;

        const existingTransaction = new ForwardedTransactionEntity();
        existingTransaction.senderAddress = mockSignatureData.struct.user;
        existingTransaction.forwardCount = 2;

        mockReq.body = mockSignatureData;
        mockQueryRunner.manager.getRepository().findOne.mockResolvedValueOnce(existingTransaction);

        await checkForwardLimit(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
        expect(nextFunction).toHaveBeenCalled();
    });

    it('should return 403 when forward count exceeds limit', async () => {
        const mockSignatureData = {
            struct: {
                user: '0x1234567890123456789012345678901234567890'
            },
            signature: '0x1234'
        } as SignatureData;

        const existingTransaction = new ForwardedTransactionEntity();
        existingTransaction.senderAddress = mockSignatureData.struct.user;
        existingTransaction.forwardCount = mockMaxForwards;

        mockReq.body = mockSignatureData;
        mockQueryRunner.manager.getRepository().findOne.mockResolvedValueOnce(existingTransaction);

        await checkForwardLimit(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Forward limit exceeded'
        });
        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 when signature data is missing', async () => {
        mockReq.body = {};

        await checkForwardLimit(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Bad request: Missing required signature data'
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 500 on database error', async () => {
        const mockSignatureData = {
            struct: {
                user: '0x1234567890123456789012345678901234567890'
            },
            signature: '0x1234'
        } as SignatureData;

        mockReq.body = mockSignatureData;
        mockQueryRunner.connect.mockRejectedValueOnce(new Error('Database error'));

        await checkForwardLimit(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Internal server error during forward limit check'
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });


});
