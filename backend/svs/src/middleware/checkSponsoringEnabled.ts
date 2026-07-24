import { Request, Response, NextFunction } from 'express'
import { ApiResponse } from '../types/apiResponses'
import { logger } from '../utils/logger'

// SVS signature sponoring is turned of per default
export function checkSponsoringEnabled(req: Request, res: Response, next: NextFunction) {
  if (req.app.get('SPONSOR_SIGNING_ENABLED') !== true) {
    logger.warn('[SponsoringEnabled] Rejected: SVS signature provision disabled')
    return res.status(503).json({
      data: null,
      error: 'SVS signature sponsoring is disabled, use on-chain sponsoring path instead',
    } as ApiResponse<null>)
  }
  next()
}
