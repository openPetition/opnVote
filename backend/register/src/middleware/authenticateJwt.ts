import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { ApiResponse } from '../types/apiResponses'

/**
 * Middleware to authenticate a Jwt is signed by AP
 * Verify the token and unpack user payload to attach to request object
 */
export function authenticateJwt(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.split(' ')[1]

    if (!token) {
      return res.status(401).json({
        data: null,
        error: 'Authorization header must be Bearer [token]',
      } as ApiResponse<null>)
    }

    // Retrieve AP public key

    const apPubKey = req.app.get('AP_JWT_PUBLIC_KEY')
    if (!apPubKey) {
      console.error('AP Jwt Public Key is not set.')
      return res.status(500).json({
        data: null,
        error: 'Internal server error. Configuration missing.',
      } as ApiResponse<null>)
    }

    // Verify Jwt
    const decoded = jwt.verify(token, apPubKey) as Partial<ApJwtPayload>

    if (
      typeof decoded.voterId !== 'number' ||
      decoded.voterId < 0 ||
      typeof decoded.electionId !== 'number' ||
      decoded.electionId < 0
    ) {
      throw new Error('Invalid Jwt payload: Expected voterId and electionId to be positive numbers')
    }

    // Unpack Jwt
    req.user = decoded as ApJwtPayload

    next()
  } catch (err) {
    // console.error('Error authenticating Jwt:', err);
    return res.status(403).json({
      data: null,
      error: 'Failed to authenticate Jwt',
    } as ApiResponse<null>)
  }
}

export default authenticateJwt
