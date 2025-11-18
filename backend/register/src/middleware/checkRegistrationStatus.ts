import { Request, Response, NextFunction } from 'express'
import { ElectionStatusService } from '../services/electionService'
import { ApiResponse } from '../types/apiResponses'

/**
 * Middleware to check the current registration status provided by Jwt.
 * Ensures registration is currently open
 */
export async function checkRegistrationStatus(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.electionId === undefined || req.user.electionId === null) {
      return res.status(401).json({
        data: null,
        error: 'Unauthorized or missing election Id',
      } as ApiResponse<null>)
    }

    const electionData = await ElectionStatusService.getElectionStatus(req.user.electionId)

    if (electionData === null) {
      return res.status(500).json({
        error: 'Failed to fetch election status',
      } as ApiResponse<null>)
    }

    if (ElectionStatusService.isRegistrationClosed(electionData)) {
      return res.status(403).json({
        error: 'Registration is closed',
      } as ApiResponse<null>)
    }

    next()
  } catch (error) {
    console.error('Error checking registration status:', error)
    return res.status(500).json({
      error: 'Failed to check registration status',
    } as ApiResponse<null>)
  }
}
