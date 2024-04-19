import { JwtPayload } from 'jsonwebtoken';
import { Request } from 'express';

declare global {
  namespace Express {
    export interface Request {
      /**
      * The user information extracted from the JWT token, if present.
      */
      user?: ApJwtPayload;
    }
  }
  /**
   * Payload of the JWT provided by AP
   */
  export interface ApJwtPayload extends JwtPayload {
    userID: number;
    electionID: number;
  }
}
// Request with attached user object
export interface RequestWithUser extends Request {
  user: ApJwtPayload;
}

