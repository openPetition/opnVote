import { Request, Response, Router } from 'express';
import { ethers } from 'ethers';
import { GelatoRelay, RelayResponse, SignatureData } from "@gelatonetwork/relay-sdk";
import { normalizeEthAddress } from 'votingsystem';
import { ApiResponse } from '../types/apiResponses';
import { dataSource } from '../database';
import { GelatoQueueEntity } from '../models/GelatoQueue';
import { GelatoQueueStatus } from '../types/gelato';
import { checkEligibility } from '../middleware/checkEligibility';
import { checkForwardLimit } from '../middleware/checkForwardLimit';
import { checkEthCall } from '../middleware/checkEthCall';
import { logger } from '../utils/logger';

const router = Router();
const GELATO_USE_QUEUE_ERROR = 'GELATO_USE_QUEUE is not set in the environment variables.';

/**
 * @openapi
 * /api/gelato/forward:
 *   post:
 *     summary: Forwards a transaction to Gelato network
 *     description: Validates and forwards the transaction either directly to Gelato relay or to an internal queue for processing
 *     tags: [Gelato Relay]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignatureData'
 *     responses:
 *       200:
 *         description: Request successfully handled (either forwarded or queued)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: null
 *                 error:
 *                   type: string
 *                   example: "Bad request: Invalid calldata"
 *       500:
 *         description: Server configuration error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: null
 *                 error:
 *                   type: string
 *                   example: "GELATO_USE_QUEUE is not set in the environment variables"
 */
router.post('/forward',
    checkEligibility,    // Validates if the transaction is eligible for sponsorship
    checkEthCall,        // Validates if the eth_call simulation succeeds
    checkForwardLimit,   // Enforces per-user forwarding rate limits
    async (req: Request, res: Response) => {
        try {

            const signatureData = req.body as SignatureData;
            const GELATO_USE_QUEUE = req.app.get('GELATO_USE_QUEUE');

            if (!signatureData?.struct || !signatureData.signature) {
                return res.status(400).json({
                    data: null,
                    error: 'Bad request: Missing required signature data'
                });
            }
            const userAddress = normalizeEthAddress(signatureData.struct.user);

            if (GELATO_USE_QUEUE === undefined) {
                return res.status(500).json({
                    data: null,
                    error: GELATO_USE_QUEUE_ERROR
                });
            }

            if (GELATO_USE_QUEUE) {

                const repository = dataSource.getRepository(GelatoQueueEntity);
                // Generate a unique requestHash
                const timestamp = Date.now().toString();
                const requestHash = ethers.id(JSON.stringify(signatureData) + timestamp);

                const queueEntry = new GelatoQueueEntity();
                queueEntry.signatureData = JSON.stringify(signatureData);
                queueEntry.status = GelatoQueueStatus.QUEUED
                queueEntry.requestHash = requestHash;
                queueEntry.gelatoUserAddress = userAddress;
                await repository.save(queueEntry);

                return res.status(200).json({
                    data: { requestHash },
                    error: null,
                });

            } else {

                // Forwarding directly to Gelato utilizing Gelato auto-scaling
                const sponsorApiKey = req.app.get('GELATO_SPONSOR_API_KEY');
                if (!sponsorApiKey) {
                    return res.status(500).json({
                        data: null,
                        error: 'Gelato Sponsor API key not configured'
                    });
                }
                const gelatoRelay = req.app.get('gelatoRelay') as GelatoRelay;
                const relayResponse: RelayResponse = await gelatoRelay.sponsoredCallERC2771WithSignature(
                    signatureData.struct,
                    signatureData.signature,
                    sponsorApiKey
                );

                return res.status(200).json({
                    data: relayResponse,
                    error: null
                })
            }

        } catch (error) {
            logger.error('[GelatoRoute] Failed to process request Error:' + error);
            res.status(500).json({
                data: null,
                error: 'Failed to queue Gelato request'
            } as ApiResponse<null>);
        }
    });

/**
 * @openapi
 * /api/gelato/tasks/{taskId}:
 *   get:
 *     summary: Retrieves the status of a requested Gelato task
 *     tags: [Gelato Relay]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         schema:
 *           type: string
 *         required: true
 *         description: The unique identifier of the task (requestHash)
 *     responses:
 *       200:
 *         description: Task status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [QUEUED, PROCESSING, COMPLETED, FAILED]
 *                 gelatoTaskId:
 *                   type: string
 *                   nullable: true
 *                   description: "Gelato's task identifier once forwarded"
 *                 txHash:
 *                   type: string
 *                   nullable: true
 *                   description: "Transaction hash once processed"
 *                 retryCount:
 *                   type: number
 *                   description: "Number of retry attempts"
 *                 failureReason:
 *                   type: string
 *                   nullable: true
 *                   description: "Reason for failure if status is FAILED"
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Queue processing is not enabled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Queue processing is not enabled"
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Task not found"
 *       500:
 *         description: Server configuration error or internal error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "GELATO_USE_QUEUE is not set in the environment variables"
 */
router.get('/tasks/:taskId', async (req: Request, res: Response) => {
    const { taskId } = req.params;
    try {
        const GELATO_USE_QUEUE = req.app.get('GELATO_USE_QUEUE')
        if (GELATO_USE_QUEUE === undefined) {
            return res.status(500).json({
                data: null,
                error: GELATO_USE_QUEUE_ERROR
            });
        }

        if (!GELATO_USE_QUEUE) {
            return res.status(500).json({
                error: 'Queue processing is not enabled'
            });
        }

        const repository = dataSource.getRepository(GelatoQueueEntity);
        const task = await repository.findOne({ where: { requestHash: taskId } });

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const response = {
            status: task.status,
            gelatoTaskId: task.gelatoTaskId || null,
            txHash: task.txHash || null,
            retryCount: task.retryCount,
            failureReason: task.failureReason || null,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt
        };

        res.status(200).json(response);
    } catch (error) {
        logger.error('[GelatoRoute] Failed to retrieve task Error:', error);
        res.status(500).json({
            error: 'Failed to retrieve task'
        });
    }
});


export default router;
