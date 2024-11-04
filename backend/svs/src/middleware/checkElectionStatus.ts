import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/apiResponses';
import { VotingTransaction, validateElectionID } from 'votingsystem';
import { ElectionService } from '../services/electionService';
import { ElectionStatusResponse } from '../types/graphql';

/**
 * Middleware to check the status of an election before allowing a vote to be cast.
 * 
 * This function verifies that the election associated with the voting transaction
 * is currently open and accepting votes. 
 * 
 * @param {Request} req - Express request object containing the voting transaction and signature.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware function.
 * @returns {Promise<void | Response>}
 */
export async function checkElectionStatus(req: Request, res: Response, next: NextFunction): Promise<void | Response> {

    // Parameters should be already validated in previous middleware
    const votingTransaction = req.body.votingTransaction as VotingTransaction;

    try {
        const electionID = votingTransaction.electionID
        validateElectionID(electionID)

        // Validate election status
        // On-chain status might differ from the current çreal election status due to delayed status update by election coordinator
        const electionData: ElectionStatusResponse | null = await ElectionService.getElectionStatus(
            electionID
        );

        // Validate election status (on-chain election status might differ from real election status)
        if (ElectionService.isElectionClosed(electionData)) {
            return res.status(403).json({
                error: 'Election is closed',
            } as ApiResponse<null>);
        }

        next();
    } catch (error) {
        // logger.error('Error checking election status:', error);
        return res.status(500).json({
            error: 'Failed to check election status',
        } as ApiResponse<null>);
    }

}
