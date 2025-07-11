import {
  ElectionCanceled as ElectionCanceledEvent,
  ElectionCreated as ElectionCreatedEvent,
  ElectionRegisterPublicKeySet as ElectionRegisterPublicKeySetEvent,
  ElectionResultsPublished as ElectionResultsPublishedEvent,
  ElectionStatusChanged as ElectionStatusChangedEvent,
  ElectionUpdated as ElectionUpdatedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  VoteCast as VoteCastEvent,
  VoteUpdated as VoteUpdatedEvent,
  VoterAuthorized as VoterAuthorizedEvent,
  VoterRegistered as VoterRegisteredEvent,
  VotersAuthorized as VotersAuthorizedEvent,
  VotersRegistered as VotersRegisteredEvent
} from "../generated/OpnVote/OpnVote"
import {
  ElectionCanceled,
  ElectionCreated,
  ElectionRegisterPublicKeySet,
  ElectionResultsPublished,
  ElectionStatusChanged,
  ElectionUpdated,
  OwnershipTransferred,
  VoteCast,
  VoteUpdated,
  VoterAuthorized,
  VoterRegistered,
  VotersAuthorized,
  VotersRegistered
} from "../generated/schema"

export function handleElectionCanceled(event: ElectionCanceledEvent): void {
  let entity = new ElectionCanceled(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.electionId = event.params.electionId
  entity.cancelReasonIpfsCid = event.params.cancelReasonIpfsCid

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleElectionCreated(event: ElectionCreatedEvent): void {
  let entity = new ElectionCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.electionId = event.params.electionId
  entity.votingStartTime = event.params.votingStartTime
  entity.votingEndTime = event.params.votingEndTime
  entity.registrationStartTime = event.params.registrationStartTime
  entity.registrationEndTime = event.params.registrationEndTime
  entity.registerId = event.params.registerId
  entity.authProviderId = event.params.authProviderId
  entity.svsId = event.params.svsId
  entity.descriptionIpfsCid = event.params.descriptionIpfsCid
  entity.publicKey = event.params.publicKey

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleElectionRegisterPublicKeySet(
  event: ElectionRegisterPublicKeySetEvent
): void {
  let entity = new ElectionRegisterPublicKeySet(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.electionId = event.params.electionId
  entity.n = event.params.n
  entity.e = event.params.e

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleElectionResultsPublished(
  event: ElectionResultsPublishedEvent
): void {
  let entity = new ElectionResultsPublished(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.electionId = event.params.electionId
  entity.yesVotes = event.params.yesVotes
  entity.noVotes = event.params.noVotes
  entity.invalidVotes = event.params.invalidVotes
  entity.privateKey = event.params.privateKey

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleElectionStatusChanged(
  event: ElectionStatusChangedEvent
): void {
  let entity = new ElectionStatusChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.electionId = event.params.electionId
  entity.oldStatus = event.params.oldStatus
  entity.newStatus = event.params.newStatus

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleElectionUpdated(event: ElectionUpdatedEvent): void {
  let entity = new ElectionUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.electionId = event.params.electionId
  entity.votingStartTime = event.params.votingStartTime
  entity.votingEndTime = event.params.votingEndTime
  entity.registrationStartTime = event.params.registrationStartTime
  entity.registrationEndTime = event.params.registrationEndTime
  entity.registerId = event.params.registerId
  entity.authProviderId = event.params.authProviderId
  entity.svsId = event.params.svsId
  entity.descriptionIpfsCid = event.params.descriptionIpfsCid
  entity.publicKey = event.params.publicKey

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.previousOwner = event.params.previousOwner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleVoteCast(event: VoteCastEvent): void {
  let entity = new VoteCast(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.electionId = event.params.electionId
  entity.voter = event.params.voter
  entity.svsSignature = event.params.svsSignature
  entity.voteEncrypted = event.params.voteEncrypted
  entity.voteEncryptedUser = event.params.voteEncryptedUser
  entity.unblindedElectionToken = event.params.unblindedElectionToken
  entity.unblindedSignature = event.params.unblindedSignature

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleVoteUpdated(event: VoteUpdatedEvent): void {
  let entity = new VoteUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.electionId = event.params.electionId
  entity.voter = event.params.voter
  entity.voteEncrypted = event.params.voteEncrypted
  entity.voteEncryptedUser = event.params.voteEncryptedUser

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleVoterAuthorized(event: VoterAuthorizedEvent): void {
  let entity = new VoterAuthorized(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.apId = event.params.apId
  entity.electionId = event.params.electionId
  entity.voterId = event.params.voterId

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleVoterRegistered(event: VoterRegisteredEvent): void {
  let entity = new VoterRegistered(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.registerId = event.params.registerId
  entity.electionId = event.params.electionId
  entity.voterId = event.params.voterId
  entity.blindedSignature = event.params.blindedSignature
  entity.blindedElectionToken = event.params.blindedElectionToken

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleVotersAuthorized(event: VotersAuthorizedEvent): void {
  let entity = new VotersAuthorized(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.apId = event.params.apId
  entity.electionId = event.params.electionId
  entity.voterIds = event.params.voterIds

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleVotersRegistered(event: VotersRegisteredEvent): void {
  let entity = new VotersRegistered(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.registerId = event.params.registerId
  entity.electionId = event.params.electionId
  entity.voterIds = event.params.voterIds
  entity.blindedSignatures = event.params.blindedSignatures
  entity.blindedElectionTokens = event.params.blindedElectionTokens

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
