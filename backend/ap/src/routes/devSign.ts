import { Request, Response, Router } from 'express'
import jwt from 'jsonwebtoken'
import { ApiResponse } from '../types/apiResponses'

const router = Router()

/**
 * @openapi
 * /api/dev/sign:
 *   post:
 *     summary: "[DEV] Sign any payload and return a JWT"
 *     description: "Issues a JWT signed with AP priv key. Only available when NODE_ENV=developmen."
 *     tags: [Dev]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - payload
 *             properties:
 *               payload:
 *                 type: object
 *                 description: "Any JWT payload e.g. { voterId: 1, electionId: 6 }"
 *               expiresIn:
 *                 type: string
 *                 description: "Optional expiry, e.g. '1h', '7d'"
 *     responses:
 *       200:
 *         description: Signed JWT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                 error:
 *                   type: string
 *                   nullable: true
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Dev signing key not configured
 */
router.post('/', (req: Request, res: Response) => {
  const { payload, expiresIn } = req.body

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return res.status(400).json({
      data: null,
      error: 'Invalid request: payload must be a non-array object',
    } as ApiResponse<null>)
  }

  const privateKey = req.app.get('DEV_AP_JWT_PRIVATE_KEY')
  if (!privateKey) {
    return res.status(500).json({
      data: null,
      error: 'Dev signing key not configured',
    } as ApiResponse<null>)
  }

  const token = jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    ...(expiresIn ? { expiresIn } : {}),
  })

  return res.status(200).json({
    data: { token },
    error: null,
  } as ApiResponse<{ token: string }>)
})

export default router
