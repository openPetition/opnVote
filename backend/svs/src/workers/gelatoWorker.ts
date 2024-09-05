import dotenv from 'dotenv';
import { dataSource } from '../database';
import { GelatoQueueEntity } from '../models/GelatoQueue';
import { GelatoRelay, RelayResponse } from "@gelatonetwork/relay-sdk";
import { GelatoQueueStatus } from '../types/gelato';
import { LessThan } from 'typeorm';
import { getEnvVar, getErrorMessage, truncateErrorMessage } from '../utils/utils';

dotenv.config();

const RATE_LIMIT = getEnvVar<number>('GELATO_RATE_LIMIT', 'number');
const PROCESSING_INTERVAL = getEnvVar<number>('GELATO_PROCESSING_INTERVAL', 'number');
const MAX_RETRIES = getEnvVar<number>('GELATO_MAX_RETRIES', 'number');
const RETRY_DELAY = getEnvVar<number>('GELATO_RETRY_DELAY', 'number');
const MAX_FAILURE_REASON_LENGTH = 255;

export async function startGelatoWorker() {
    const gelatoRelay = new GelatoRelay();
    const repository = dataSource.getRepository(GelatoQueueEntity);

    setInterval(async () => {
        try {
            const pendingRequests = await repository.find({
                where: [
                    { status: GelatoQueueStatus.QUEUED },
                    { status: GelatoQueueStatus.RETRY, retryAt: LessThan(new Date()) }
                ],
                take: RATE_LIMIT,
                order: { createdAt: 'ASC' }
            });

            for (const request of pendingRequests) {
                request.status = GelatoQueueStatus.PROCESSING;
                await repository.save(request);

                try {
                    const signatureData = JSON.parse(request.signatureData);
                    const sponsorApiKey = process.env.GELATO_SPONSOR_API_KEY;

                    if (!sponsorApiKey) {
                        throw new Error('Gelato Sponsor API key not configured');
                    }

                    const relayResponse: RelayResponse = await gelatoRelay.sponsoredCallERC2771WithSignature(
                        signatureData.struct,
                        signatureData.signature,
                        sponsorApiKey
                    );

                    request.status = GelatoQueueStatus.SUBMITTED;
                    request.gelatoTaskId = relayResponse.taskId;
                    request.failureReason = null; 
                    await repository.save(request);

                    console.log(`Request ${request.id} submitted successfully after ${request.retryCount} retries.`);
                } catch (error) {
                    console.error('Error processing Gelato request:', error);
                    const errorMessage = truncateErrorMessage(getErrorMessage(error), MAX_FAILURE_REASON_LENGTH);
                    if (request.retryCount < MAX_RETRIES) {
                        request.status = GelatoQueueStatus.RETRY;
                        request.retryCount += 1;
                        request.retryAt = new Date(Date.now() + RETRY_DELAY);
                        request.failureReason = errorMessage;
                    } else {
                        request.status = GelatoQueueStatus.FAILED;
                        request.failureReason = truncateErrorMessage(`Max retries (${MAX_RETRIES}) reached. Last error: ${errorMessage}`, MAX_FAILURE_REASON_LENGTH);
                    }
                    await repository.save(request);
                }
            }
        } catch (error) {
            console.error('Error in Gelato worker:', error);
        }
    }, PROCESSING_INTERVAL);
}
