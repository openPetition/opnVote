import { JwtPayload } from 'jsonwebtoken'
import { Request } from 'express'

declare global {
  namespace Express {
    export interface Request {
      /**
       * The user information extracted from the Jwt token, if present.
       */
      user?: ApJwtPayload
    }
  }
  /**
   * Payload of the Jwt provided by AP
   */
  export interface ApJwtPayload extends JwtPayload {
    voterId: number
    electionId: number
  }
}
// Request with attached user object
export interface RequestWithUser extends Request {
  user: ApJwtPayload
}
