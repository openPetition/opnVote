import { Request, Response, NextFunction } from 'express';
import { ElectionStatusService } from '../services/electionService';
import { ApiResponse } from '../types/apiResponses';


/**
 * Middleware to check the current election status provided by JWT.
 * Ensures election is currently open
 */
export async function checkElectionStatus(req: Request, res: Response, next: NextFunction) {
    try {

        if (!req.user || req.user.electionID === undefined || req.user.electionID === null) {
            return res.status(401).json({
                data: null,
                error: 'Unauthorized or missing election ID',
            } as ApiResponse<null>);
        }

        // Validate election status
        // On-chain status might differ from the current real election status due to delayed status update by election coordinator
        const electionData = await ElectionStatusService.getElectionStatus(
            req.user.electionID
        );
        
        // validate election status (on-chain election status might differ from real election status)
        if (ElectionStatusService.isElectionClosed(electionData)) {
            return res.status(403).json({
                error: 'Election is closed',
            } as ApiResponse<null>);
        }


        next();
    } catch (error) {
        console.error('Error checking election status:', error);
        return res.status(500).json({
            error: 'Failed to check election status',
        } as ApiResponse<null>);
    }
}

