import { Request, Response, Router } from 'express'
import { jwtTokenValidator } from '../validation/authvalidation'
import authenticateJWT from '../middleware/authenticateJWT'
import { Authorization } from '../models/Authorization'
import { dataSource } from '../database'
import { ApiResponse } from '../types/apiResponses'
import { logger } from '../utils/logger'
import { fetchElectionAuthProvider } from '../graphql/graphqlClient'

const router = Router()

/**
 * API request structure for authorization endpoint.
 */
interface AuthorizationRequest {
  electionId: number
  voterIds: string[]
}

interface AuthorizationResult {
  successfulIds: number[]
  failedIds: { voterId: number; electionId: number; error: string }[]
  totalProcessed: number
}

/**
 * @openapi
 * /api/authorize:
 *   post:
 *     summary: Authorize multiple voters for an election
 *     description: Processes authorization request for multiple voters in a single election. Each voter authorization is processed individually - failures of individual authorizations do not affect others.
 *     tags: [Authorization]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               electionId:
 *                 type: number
 *                 description: "ID of the election"
 *                 example: 1
 *               voterIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   description: "Voter IDs as strings"
 *                 example: ["123", "456", "789"]
 *     responses:
 *       200:
 *         description: Authorization processing completed. Returns both successful and failed authorizations.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     successfulIds:
 *                       type: array
 *                       items:
 *                         type: number
 *                       description: "Array of successfully authorized voter IDs"
 *                     failedIds:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           voterId:
 *                             type: number
 *                           electionId:
 *                             type: number
 *                           error:
 *                             type: string
 *                       description: "Array of failed authorizations with error details"
 *                     totalProcessed:
 *                       type: number
 *                       description: "Total number of voter authorizations processed"
 *                 error:
 *                   type: string
 *                   nullable: true
 *       400:
 *         description: Invalid request format or missing required fields.
 *       401:
 *         description: Unauthorized - No valid JWT or authorization header.
 *       500:
 *         description: Internal server error.
 */

router.post(
  '/',
  jwtTokenValidator(), // Checks if JWT is present in Authorization header.
  authenticateJWT, // Checks if JWT is valid
  async (req: Request, res: Response) => {
    const startTime = Date.now()

    try {
      const { electionId, voterIds } = req.body as AuthorizationRequest

      if (!electionId || !voterIds || !Array.isArray(voterIds) || voterIds.length === 0) {
        return res.status(400).json({
          data: null,
          error:
            'Invalid request: electionId and voterIds array are required and voterIds must not be empty',
        } as ApiResponse<null>)
      }

      // Validate JWT electionID matches request electionID
      if (req.user!.electionId !== electionId) {
        return res.status(403).json({
          data: null,
          error: 'JWT electionId does not match request electionId',
        } as ApiResponse<null>)
      }

      const currentApId = req.app.get('AP_ID')
      if (!currentApId) {
        logger.error('AP_ID not configured')
        return res.status(500).json({
          data: null,
          error: 'AP not configured',
        } as ApiResponse<null>)
      }

      try {
        const electionAuthProvider = await fetchElectionAuthProvider(electionId)
        if (!electionAuthProvider) {
          return res.status(404).json({
            data: null,
            error: 'Election not found',
          } as ApiResponse<null>)
        }

        if (electionAuthProvider.authProviderId !== Number(currentApId)) {
          logger.warn(
            `AP ${currentApId} tried to authorize for election ${electionId}. Election belongs to AP ${electionAuthProvider.authProviderId}`,
          )
          return res.status(403).json({
            data: null,
            error: 'AP not allowed to authorize for this election',
          } as ApiResponse<null>)
        }
      } catch (error) {
        logger.error(`Failed to retrieve AP for election ${electionId}: ${error}`)
        return res.status(500).json({
          data: null,
          error: 'Failed to retrieve AP for election',
        } as ApiResponse<null>)
      }

      logger.info(
        `Processing authorization request for ${voterIds.length} voters in election ${electionId}`,
      )

      const result: AuthorizationResult = {
        successfulIds: [],
        failedIds: [],
        totalProcessed: 0,
      }

      logger.debug(`Processing ${voterIds.length} voters for election ${electionId}`)

      for (const voterId of voterIds) {
        result.totalProcessed++
        const voterIdNumber = Number(voterId)

        try {
          await dataSource
            .createQueryBuilder()
            .insert()
            .into(Authorization)
            .values({
              voterId: voterIdNumber,
              electionId: electionId,
              onchainStatus: 'pending',
              txHash: null,
              batchId: null,
            })
            .execute()

          result.successfulIds.push(voterIdNumber)
          logger.debug(`Successfully authorized voter ${voterIdNumber} for election ${electionId}`)
        } catch (error: any) {
          const errorMessage =
            error.code === 'ER_DUP_ENTRY'
              ? 'Voter already authorized for this election'
              : error.message || 'Database error'

          result.failedIds.push({
            voterId: voterIdNumber,
            electionId: electionId,
            error: errorMessage,
          })

          logger.warn(
            `Failed to authorize voter ${voterIdNumber} for election ${electionId}: ${errorMessage}`,
          )
        }
      }

      const duration = Date.now() - startTime
      logger.info(
        `Authorization processing completed in ${duration}ms. ` +
          `Successful: ${result.successfulIds.length}, ` +
          `Failed: ${result.failedIds.length}, ` +
          `Total: ${result.totalProcessed}`,
      )

      return res.status(200).json({
        data: result,
        error: null,
      } as ApiResponse<AuthorizationResult>)
    } catch (error) {
      const duration = Date.now() - startTime
      logger.error(`Error in authorization processing after ${duration}ms: ${error}`)

      return res.status(500).json({
        data: null,
        error: 'Internal server error during authorization processing',
      } as ApiResponse<null>)
    }
  },
)

export default router
