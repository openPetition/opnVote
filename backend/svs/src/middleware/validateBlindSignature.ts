import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/apiResponses';
import { RSAParams, Signature, Token, VotingTransaction, validateRSAParams, verifyUnblindedSignature } from 'votingsystem';
import { ElectionService } from '../services/electionService';


/**
 * Middleware to validate the blind signature in the voting transaction.
 * 
 * This function verifies that the unblinded signature provided in the voting transaction
 * is valid. It ensures that the voter has received a legitimate blind signature from the register.
 *
 * @param {Request} req - Express request object containing the voting transaction and signature.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware function.
 * @returns {Promise<void | Response>}
 */
export async function validateBlindSignature(req: Request, res: Response, next: NextFunction): Promise<void | Response> {

    const votingTransaction = req.body.votingTransaction as VotingTransaction;

    try {
        const electionID: number = votingTransaction.electionID
        const unblindedSignature: Signature = votingTransaction.unblindedSignature
        const unblindedElectionToken: Token = votingTransaction.unblindedElectionToken

        const registerPubKey: RSAParams | null = await ElectionService.getElectionRegisterPublicKey(electionID)
        if (!registerPubKey) {
            return res.status(500).json({
                error: `Could not retrieve Register Public Key for Election ${electionID}. Please try again later.`
            });
        }
        validateRSAParams(registerPubKey)

        // Verify the unblinded signature using the election's register public key
        const isValidSignature: Boolean = verifyUnblindedSignature(unblindedSignature, unblindedElectionToken, registerPubKey)
        if (!isValidSignature) {
            return res.status(401).json({
                data: null,
                error: 'Blinded Signature is not valid'
            });
        }

        next();
    } catch (error: any) {
        if (error.message && error.message.includes("out of range")) {
            return res.status(401).json({
                data: null,
                error: 'Blinded Signature is not valid'
            });
        }
        // logger.error('Error processing signature validation:', error);
        return res.status(500).json({
            error: 'Failed to validate Blind Signature',
        } as ApiResponse<null>);
    }
}
