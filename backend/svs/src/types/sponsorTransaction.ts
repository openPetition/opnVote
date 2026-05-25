import { RecastingVotingTransaction, VotingTransaction } from 'votingsystem'

export type SponsorVotingTransaction = VotingTransaction | RecastingVotingTransaction

export function isRecastingVotingTransaction(
  votingTransaction: SponsorVotingTransaction,
): votingTransaction is RecastingVotingTransaction {
  return !('unblindedSignature' in votingTransaction)
}
