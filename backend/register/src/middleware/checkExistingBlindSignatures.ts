import { Request, Response, NextFunction } from 'express';
import { BlindedSignature } from '../models/BlindedSignature';
import { dataSource } from '../database';
import { RequestWithUser } from '../types/jwt';
import { ApiResponse } from '../types/apiResponses';
import { Token } from 'votingsystem';


/**
 * Middleware to check if user already received a blinded Signature for election ID
 */
export async function checkForExistingBlindedSignature(req: Request, res: Response, next: NextFunction) { 

  // Assumes user has already been authorized by JWT check
  const reqWithUser = req as RequestWithUser; 

  if (!reqWithUser.user) {
    return res.status(401).json({
      data: null,
      error: "User not authorized",
    } as ApiResponse<null>);
    }
  
  const userID = reqWithUser.user.userID;
  const electionID = reqWithUser.user.electionID;
  const blindedToken = req.body.token as Token;

  try {
    // Search for BlindSignature entries with same userID & electionID
    const repository = dataSource.getRepository(BlindedSignature);
    const existingSignature = await repository.findOne({
      where: {
        userID: userID,
        electionID: electionID,
      },
    });

    if (existingSignature) {
      // Return existing blind Signature if provided same blinded Token
      if (existingSignature.blindedToken.toLowerCase() === blindedToken.hexString.toLowerCase()) {
        return res.status(200).json({
          data: {
            message: 'Existing blinded signature found.',
            blindedSignature: existingSignature.blindedSignature,
          },
          error: null
        } as ApiResponse<{ message: string, blindedSignature: string }>);
      } else {
        // User already requested blinded Signature for a different Blinded Token 
        return res.status(400).json({
          data: null,
          error: 'Already registered',
        } as ApiResponse<null>);
      }
    }

    next();
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({
      data: null,
      error: 'Internal server error',
    } as ApiResponse<null>);
  }
};

export default checkForExistingBlindedSignature;