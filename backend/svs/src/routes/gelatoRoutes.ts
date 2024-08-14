import { Request, Response, Router } from 'express';
import { ApiResponse } from '../types/apiResponses';
import { GelatoRelay, RelayResponse, SignatureData } from "@gelatonetwork/relay-sdk";



const router = Router();

/**
 * @openapi
 * /api/gelato/forward:
 *   post:
 *     summary: Forwards a signature request to Gelato network.
 *     description: Validates and forwards the signature data to the Gelato relay for processing.
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
 *         description: Request successfully forwarded and processed by Gelato.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 taskId:
 *                   type: string
 *                   description: "A unique identifier for the task processed by Gelato."
 *                   example: "task_123456"
 *       400:
 *         description: Bad request due to missing or malformed data.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing required signature data"
 *       500:
 *         description: Internal server error or configuration issue.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Gelato Sponsor API key not configured"
 * components:
 *   schemas:
 *     SignatureData:
 *       type: object
 *       properties:
 *         struct:
 *           type: object
 *           description: "Structure of the request to be signed and sent."
 *           properties:
 *             userDeadline:
 *               type: integer
 *               example: 1717658887
 *             chainId:
 *               type: integer
 *               example: 100
 *             target:
 *               type: string
 *               example: "0xB2971419Bb6437856Eb9Ec8CA3e56958Af45Eee9"
 *             data:
 *               type: string
 *               example: "0xff6cc66e..."
 *             user:
 *               type: string
 *               example: "0x38120f5abb96c54B3d6127Dd0be7B049ecE0D0FD"
 *             userNonce:
 *               type: integer
 *               example: 0
 *         signature:
 *           type: string
 *           example: "0x792bad99..."
 */
router.post('/forward', async (req: Request, res: Response) => {
    try {
        const signatureData = req.body as SignatureData;

        if (!signatureData || !signatureData.struct || !signatureData.signature) {
            return res.status(400).json({
                data: null,
                error: 'Bad request: Missing required signature data'
            });
        }
        //! todo: Validate signatureData structure
        //! todo: Validate signatureData with eth_Call

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
        });

    } catch (error) {
        console.error('Error forwarding request to gelato:', error);
        res.status(500).json({
            data: null,
            error: 'Failed to forward request to Gelato. Error: ' + error
        } as ApiResponse<null>);
    };
});



export default router;
