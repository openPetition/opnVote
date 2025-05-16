import { Request, Response } from 'express';
import { checkForwardLimit } from './checkForwardLimit';
import { dataSource } from '../database';
import { SignatureData } from '@gelatonetwork/relay-sdk';
import { ForwardedTransactionEntity } from '../models/ForwardedTransaction';

jest.mock('../database', () => ({
    dataSource: {
        createQueryRunner: jest.fn(),
    },
}));

describe('checkForwardLimit Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let nextFunction: jest.Mock;
    let mockAppGet: jest.Mock;
    const defaultMockMaxForwards = 3;

    let mockRepository: {
        findOne: jest.Mock;
        create: jest.Mock;
        save: jest.Mock;
    };

    let mockQueryRunner: any;
    let actualIsTransactionActive = false;

    beforeEach(() => {
        jest.clearAllMocks();
        actualIsTransactionActive = false;

        mockAppGet = jest.fn().mockReturnValue(defaultMockMaxForwards);
        mockReq = {
            body: {},
            app: {
                get: mockAppGet,
            } as any,
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        nextFunction = jest.fn();

        mockRepository = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn().mockResolvedValue({}),
        };

        mockQueryRunner = {
            connect: jest.fn().mockResolvedValue(undefined),
            startTransaction: jest.fn().mockImplementation(() => {
                actualIsTransactionActive = true;
                return Promise.resolve(undefined);
            }),
            commitTransaction: jest.fn().mockImplementation(() => {
                actualIsTransactionActive = false;
                return Promise.resolve(undefined);
            }),
            rollbackTransaction: jest.fn().mockImplementation(() => {
                actualIsTransactionActive = false;
                return Promise.resolve(undefined);
            }),
            release: jest.fn().mockResolvedValue(undefined),
        };

        Object.defineProperty(mockQueryRunner, 'isTransactionActive', {
            get: jest.fn(() => actualIsTransactionActive),
            configurable: true
        });

        mockQueryRunner.manager = {
            getRepository: jest.fn().mockImplementation((entity) => {
                if (entity === ForwardedTransactionEntity) {
                    return mockRepository;
                }
                return { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
            }),
        };

        (dataSource.createQueryRunner as jest.Mock).mockReturnValue(mockQueryRunner);

        mockRepository.findOne.mockResolvedValue(null);
        mockRepository.create.mockImplementation((data) => ({ ...data, id: 'mock-id' }));
    });

    it('should pass when creating first forward request (new user)', async () => {
        const senderAddress = '0x1234567890123456789012345678901234567890';
        const mockSignatureData = {
            struct: { user: senderAddress },
            signature: '0x1234',
        } as SignatureData;
        mockReq.body = mockSignatureData;

        mockRepository.findOne.mockResolvedValueOnce(null);
        const newRecord = { senderAddress, forwardCount: 1 };
        mockRepository.create.mockReturnValueOnce(newRecord);
        mockRepository.save.mockResolvedValueOnce(newRecord);

        await checkForwardLimit(mockReq as Request, mockRes as Response, nextFunction);

        expect(dataSource.createQueryRunner).toHaveBeenCalledTimes(1);
        expect(mockQueryRunner.connect).toHaveBeenCalledTimes(1);
        expect(mockQueryRunner.startTransaction).toHaveBeenCalledWith('READ COMMITTED');
        expect(mockQueryRunner.manager.getRepository).toHaveBeenCalledWith(ForwardedTransactionEntity);

        expect(mockRepository.findOne).toHaveBeenCalledWith({
            where: { senderAddress },
            lock: { mode: 'pessimistic_write' },
        });
        expect(mockRepository.create).toHaveBeenCalledWith({ senderAddress, forwardCount: 1 });
        expect(mockRepository.save).toHaveBeenCalledWith(newRecord);

        expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
        expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
        expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();

        expect(nextFunction).toHaveBeenCalledTimes(1);
        expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should pass when forward count is below limit', async () => {
        const senderAddress = '0x1234567890123456789012345678901234567890';
        const mockSignatureData = {
            struct: { user: senderAddress },
            signature: '0xabcd',
        } as SignatureData;
        mockReq.body = mockSignatureData;

        const existingForwardCount = 1;
        const existingRecord = { senderAddress, forwardCount: existingForwardCount, id: 'mock-id-existing' };
        mockRepository.findOne.mockResolvedValueOnce(existingRecord);

        const updatedRecord = { ...existingRecord, forwardCount: existingForwardCount + 1 };
        mockRepository.save.mockResolvedValueOnce(updatedRecord);


        await checkForwardLimit(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
        expect(mockRepository.findOne).toHaveBeenCalledWith({
            where: { senderAddress },
            lock: { mode: 'pessimistic_write' },
        });
        expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({ forwardCount: existingForwardCount + 1 }));
        expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
        expect(mockQueryRunner.release).toHaveBeenCalled();
        expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
        expect(nextFunction).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 403 when forward count is at limit', async () => {
        const senderAddress = '0x1234567890123456789012345678901234567890';
        const mockSignatureData = {
            struct: { user: senderAddress },
            signature: '0xefgh',
        } as SignatureData;
        mockReq.body = mockSignatureData;

        const existingRecord = { senderAddress, forwardCount: defaultMockMaxForwards, id: 'mock-id-limit' };
        mockRepository.findOne.mockResolvedValueOnce(existingRecord);

        await checkForwardLimit(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
        expect(mockRepository.findOne).toHaveBeenCalledWith({
            where: { senderAddress },
            lock: { mode: 'pessimistic_write' },
        });
        expect(mockRepository.save).not.toHaveBeenCalled();
        expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
        expect(mockQueryRunner.release).toHaveBeenCalled();

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Forward limit exceeded',
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 403 if MAX_FORWARDS is 0, and user already exists with some forwards', async () => {
        const senderAddress = '0x1234567890123456789012345678901234567890';
        const mockSignatureData = {
            struct: { user: senderAddress },
            signature: '0xijkl',
        } as SignatureData;
        mockReq.body = mockSignatureData;
        mockAppGet.mockReturnValue(0);

        const existingRecord = { senderAddress, forwardCount: 1, id: 'mock-id-max0-existing' };
        mockRepository.findOne.mockResolvedValueOnce(existingRecord);

        await checkForwardLimit(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
        expect(mockRepository.findOne).toHaveBeenCalledWith({
            where: { senderAddress },
            lock: { mode: 'pessimistic_write' },
        });
        expect(mockRepository.save).not.toHaveBeenCalled();
        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
        expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
        expect(mockQueryRunner.release).toHaveBeenCalled();

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Forward limit exceeded',
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should allow first forward and set count to 1 if MAX_FORWARDS is 0 and user does not exist', async () => {
        const senderAddress = '0x1234567890123456789012345678901234567890';
        const mockSignatureData = {
            struct: { user: senderAddress },
            signature: '0xabcde',
        } as SignatureData;
        mockReq.body = mockSignatureData;
        mockAppGet.mockReturnValue(0);

        mockRepository.findOne.mockResolvedValueOnce(null);
        const newRecord = { senderAddress, forwardCount: 1 };
        mockRepository.create.mockReturnValueOnce(newRecord);
        mockRepository.save.mockResolvedValueOnce(newRecord);

        await checkForwardLimit(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
        expect(mockRepository.findOne).toHaveBeenCalledWith({
            where: { senderAddress },
            lock: { mode: 'pessimistic_write' },
        });
        expect(mockRepository.create).toHaveBeenCalledWith({ senderAddress, forwardCount: 1 });
        expect(mockRepository.save).toHaveBeenCalledWith(newRecord);
        expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
        expect(mockQueryRunner.release).toHaveBeenCalled();
        expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();

        expect(nextFunction).toHaveBeenCalledTimes(1);
        expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 400 when signature data is missing entirely', async () => {
        mockReq.body = {};

        await checkForwardLimit(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Bad request: Missing required signature data',
        });
        expect(nextFunction).not.toHaveBeenCalled();
        expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('should return 400 when signature data is incomplete (missing struct)', async () => {
        mockReq.body = { signature: '0x123' };

        await checkForwardLimit(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Bad request: Missing required signature data',
        });
        expect(nextFunction).not.toHaveBeenCalled();
        expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('should return 400 when signature data is incomplete (missing signature)', async () => {
        mockReq.body = { struct: { user: '0x123' } };

        await checkForwardLimit(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Bad request: Missing required signature data',
        });
        expect(nextFunction).not.toHaveBeenCalled();
        expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });


    it('should return 500 if queryRunner.connect fails', async () => {
        const senderAddress = '0x1234567890123456789012345678901234567890';
        const mockSignatureData = {
            struct: { user: senderAddress },
            signature: '0xerror',
        } as SignatureData;
        mockReq.body = mockSignatureData;

        mockQueryRunner.connect.mockRejectedValueOnce(new Error('Simulated connect error'));

        await checkForwardLimit(mockReq as Request, mockRes as Response, nextFunction);

        expect(dataSource.createQueryRunner).toHaveBeenCalled();
        expect(mockQueryRunner.connect).toHaveBeenCalled();
        expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
        expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Internal server error during forward limit check',
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 500 if repo.findOne fails', async () => {
        const senderAddress = '0x1234567890123456789012345678901234567890';
        const mockSignatureData = {
            struct: { user: senderAddress },
            signature: '0xerrorFind',
        } as SignatureData;
        mockReq.body = mockSignatureData;

        mockRepository.findOne.mockRejectedValueOnce(new Error('Simulated findOne error'));

        await checkForwardLimit(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
        expect(mockRepository.findOne).toHaveBeenCalled();
        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
        expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Internal server error during forward limit check',
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 500 if repo.save fails (for new user)', async () => {
        const senderAddress = '0x1234567890123456789012345678901234567890';
        const mockSignatureData = {
            struct: { user: senderAddress },
            signature: '0xerror',
        } as SignatureData;
        mockReq.body = mockSignatureData;

        mockRepository.findOne.mockResolvedValueOnce(null);
        const newRecord = { senderAddress, forwardCount: 1 };
        mockRepository.create.mockReturnValueOnce(newRecord);
        mockRepository.save.mockRejectedValueOnce(new Error('Simulated save error'));

        await checkForwardLimit(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
        expect(mockRepository.findOne).toHaveBeenCalled();
        expect(mockRepository.create).toHaveBeenCalled();
        expect(mockRepository.save).toHaveBeenCalled();
        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
        expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Internal server error during forward limit check',
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 500 if repo.save fails (for existing user)', async () => {
        const senderAddress = '0x1234567890123456789012345678901234567890';
        const mockSignatureData = {
            struct: { user: senderAddress },
            signature: '0xerrorSaveExisting',
        } as SignatureData;
        mockReq.body = mockSignatureData;

        const existingRecord = { senderAddress, forwardCount: 1, id: 'mock-id-save-fail' };
        mockRepository.findOne.mockResolvedValueOnce(existingRecord);
        mockRepository.save.mockRejectedValueOnce(new Error('Simulated save error'));

        await checkForwardLimit(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
        expect(mockRepository.findOne).toHaveBeenCalled();
        expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({ forwardCount: 2 }));
        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
        expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            data: null,
            error: 'Internal server error during forward limit check',
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });
});
