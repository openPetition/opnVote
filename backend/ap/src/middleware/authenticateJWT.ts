import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { ApiResponse } from '../types/apiResponses'

/**
 * Middleware to authenticate a JWT is signed by AP
 * Verify the token and unpack authorization payload to attach to request object
 */
export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
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
      console.error('AP JWT Public Key is not set.')
      return res.status(500).json({
        data: null,
        error: 'Internal server error. Configuration missing.',
      } as ApiResponse<null>)
    }

    // Verify JWT
    const decoded = jwt.verify(token, apPubKey) as Partial<ApJwtPayload>

    if (typeof decoded.electionId !== 'number' || decoded.electionId < 0) {
      throw new Error('Invalid JWT payload: Expected electionId to be a positive number')
    }

    // Unpack JWT
    req.user = decoded as ApJwtPayload

    next()
  } catch (err) {
    // console.error('Error authenticating JWT:', err);
    return res.status(403).json({
      data: null,
      error: 'Failed to authenticate JWT',
    } as ApiResponse<null>)
  }
}

export default authenticateJWT
