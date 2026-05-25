import { SponsorVotingTransaction } from './sponsorTransaction'

declare global {
  namespace Express {
    interface Request {
      votingTransaction?: SponsorVotingTransaction
    }
  }
}
