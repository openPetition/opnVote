import { VotingTransaction } from 'votingsystem'

declare global {
  namespace Express {
    interface Request {
      votingTransaction?: VotingTransaction
    }
  }
}
