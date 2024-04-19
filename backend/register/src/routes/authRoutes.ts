import { Request, Response, Router } from 'express';

import { jwtTokenValidator } from '../validation/authvalidation';
import authenticateJWT from '../middleware/authenticateJWT';
import { checkElectionStatus } from '../middleware/checkElectionStatus';
import { ApiResponse } from '../types/apiResponses';

const router = Router();

/**
 * @openapi
 * /api/auth:
 *   get:
 *     summary: Validates the JWT and checks election status.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: JWT is valid and the election status is pending or open.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Successfully authenticated
 *       401:
 *         description: Unauthorized - JWT missing, not in correct format, or missing election ID
 *       403:
 *         description: Access Forbidden - JWT failed to authenticate or election is closed
 *       500:
 *         description: Internal server error due to missing server configuration or failure in checking election status
 */

router.get('/',
    jwtTokenValidator(),      // Checks if JWT is present in Authorization header
    authenticateJWT,        // Checks if JWT is valid
    checkElectionStatus,    // Confirms that election status is Pending or Open
    (req: Request, res: Response) => {

        const response: ApiResponse<{ message: string }> = {
            data: {
                message: "Successfully authenticated",
            },
            error: null,
        };
        res.json(response);
    });

export default router;
