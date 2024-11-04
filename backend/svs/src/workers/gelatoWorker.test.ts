import { GelatoRelay, RelayResponse, TransactionStatusResponse } from "@gelatonetwork/relay-sdk";
import { dataSource } from '../database';
import { GelatoQueueEntity } from '../models/GelatoQueue';
import { GelatoQueueStatus } from '../types/gelato';
import { processPendingRequests, TaskState, updateTaskStates } from './gelatoWorker';
import { Repository } from 'typeorm';

jest.mock('@gelatonetwork/relay-sdk');
jest.mock('../database');

describe('Gelato Worker', () => {
    let mockGelatoRelay: jest.Mocked<GelatoRelay>;
    let mockRepository: jest.Mocked<Repository<GelatoQueueEntity>>;

    beforeEach(() => {
        jest.useFakeTimers();
        process.env.GELATO_SPONSOR_API_KEY = 'test-api-key';
        process.env.GELATO_RATE_LIMIT = '10';
        process.env.GELATO_PROCESSING_INTERVAL = '1000';
        process.env.GELATO_MAX_RETRIES = '3';
        process.env.GELATO_RETRY_DELAY = '5000';
        process.env.GELATO_STATUS_UPDATE_INTERVAL = '2000';

        mockGelatoRelay = {
            sponsoredCallERC2771WithSignature: jest.fn(),
            getTaskStatus: jest.fn(),
        } as any;

        mockRepository = {
            find: jest.fn(),
            save: jest.fn(),
        } as any;

        (dataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    describe('processPendingRequests', () => {
        it('should process queued requests successfully', async () => {
            const mockRequest = new GelatoQueueEntity();
            mockRequest.status = GelatoQueueStatus.QUEUED;
            mockRequest.requestHash = '0x123';
            mockRequest.signatureData = JSON.stringify({
                struct: { user: '0x123' },
                signature: '0xabc'
            });

            mockRepository.find.mockResolvedValueOnce([mockRequest]);
            mockGelatoRelay.sponsoredCallERC2771WithSignature.mockResolvedValueOnce({
                taskId: 'task-123'
            } as RelayResponse);

            await processPendingRequests(mockGelatoRelay, mockRepository);

            expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({
                status: GelatoQueueStatus.SUBMITTED,
                gelatoTaskId: 'task-123'
            }));
        });

        it('should handle retry logic when request fails', async () => {
            const mockRequest = new GelatoQueueEntity();
            mockRequest.status = GelatoQueueStatus.QUEUED;
            mockRequest.requestHash = '0x123';
            mockRequest.retryCount = 0;
            mockRequest.signatureData = JSON.stringify({
                struct: { user: '0x123' },
                signature: '0xabc'
            });

            mockRepository.find.mockResolvedValueOnce([mockRequest]);
            mockGelatoRelay.sponsoredCallERC2771WithSignature.mockRejectedValueOnce(new Error('Request failed'));

            await processPendingRequests(mockGelatoRelay, mockRepository);

            expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({
                status: GelatoQueueStatus.RETRY,
                retryCount: 1
            }));
        });

        it('should mark request as failed when max retries reached', async () => {
            const mockRequest = new GelatoQueueEntity();
            mockRequest.status = GelatoQueueStatus.QUEUED;
            mockRequest.requestHash = '0x123';
            mockRequest.retryCount = Number(process.env.GELATO_MAX_RETRIES);
            mockRequest.signatureData = JSON.stringify({
                struct: { user: '0x123' },
                signature: '0xabc'
            });

            mockRepository.find.mockResolvedValueOnce([mockRequest]);
            mockGelatoRelay.sponsoredCallERC2771WithSignature.mockRejectedValueOnce(new Error('Request failed'));

            await processPendingRequests(mockGelatoRelay, mockRepository);

            expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({
                status: GelatoQueueStatus.FAILED,
                failureReason: expect.stringContaining('Max retries')
            }));
        });
        it('should handle missing sponsor API key', async () => {
            process.env.GELATO_SPONSOR_API_KEY = '';

            const mockRequest = new GelatoQueueEntity();
            mockRequest.status = GelatoQueueStatus.QUEUED;
            mockRequest.requestHash = '0x123';
            mockRequest.retryCount = 0;
            mockRequest.signatureData = JSON.stringify({
                struct: { user: '0x123' },
                signature: '0xabc'
            });

            mockRepository.find.mockResolvedValueOnce([mockRequest]);

            await processPendingRequests(mockGelatoRelay, mockRepository);

            expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({
                status: GelatoQueueStatus.RETRY,
                failureReason: expect.stringContaining('Gelato Sponsor API key not configured')
            }));
        });
    });


    describe('updateTaskStates', () => {
        it('should update task status to CONFIRMED on ExecSuccess', async () => {
            const mockTask = new GelatoQueueEntity();
            mockTask.status = GelatoQueueStatus.SUBMITTED;
            mockTask.gelatoTaskId = 'task-123';

            mockRepository.find.mockResolvedValueOnce([mockTask]);
            mockGelatoRelay.getTaskStatus.mockResolvedValueOnce({
                taskState: TaskState.ExecSuccess
            } as TransactionStatusResponse);

            await updateTaskStates(mockGelatoRelay, mockRepository);

            expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({
                status: GelatoQueueStatus.CONFIRMED
            }));
        });

        it('should not update status for pending tasks', async () => {
            const mockTask = new GelatoQueueEntity();
            mockTask.status = GelatoQueueStatus.SUBMITTED;
            mockTask.gelatoTaskId = 'task-123';

            mockRepository.find.mockResolvedValueOnce([mockTask]);
            mockGelatoRelay.getTaskStatus.mockResolvedValueOnce({
                taskState: TaskState.CheckPending
            } as TransactionStatusResponse);

            await updateTaskStates(mockGelatoRelay, mockRepository);

            expect(mockRepository.save).not.toHaveBeenCalled();
        });
    });
});
