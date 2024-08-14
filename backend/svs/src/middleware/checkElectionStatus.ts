import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/apiResponses';
import { EthSignature, VotingTransaction, validateElectionID } from 'votingsystem';
import { ElectionService } from '../services/electionService';
import { ElectionStatusResponse } from '../types/graphql';

export async function checkElectionStatus(req: Request, res: Response, next: NextFunction) {

    // Parameters should be already validated in previous middleware
    const votingTransaction = req.body.votingTransaction as VotingTransaction;
    const voterSignature = req.body.voterSignature as EthSignature;

    if (!votingTransaction || !voterSignature) {
        return res.status(401).json({
            data: null,
            error: 'Unauthorized or missing Voter Signature'
        });
    }
    try {
        const electionID = votingTransaction.electionID
        validateElectionID(electionID)
        // Validate election status
        // On-chain status might differ from the current çreal election status due to delayed status update by election coordinator
        const electionData:ElectionStatusResponse|null = await ElectionService.getElectionStatus(
            electionID
        );

        // validate election status (on-chain election status might differ from real election status)
        if (ElectionService.isElectionClosed(electionData)) {
            return res.status(403).json({
                error: 'Election is closed',
            } as ApiResponse<null>);
        }

        next();
    } catch (error) {
        // console.error('Error checking election status:', error);
        return res.status(500).json({
            error: 'Failed to check election status',
        } as ApiResponse<null>);
    }

}
