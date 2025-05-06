import {
  ElectionCanceled as ElectionCanceledEvent,
  ElectionCreated as ElectionCreatedEvent,
  ElectionRegisterPublicKeySet as ElectionRegisterPublicKeySetEvent,
  ElectionResultsPublished as ElectionResultsPublishedEvent,
  ElectionStatusChanged as ElectionStatusChangedEvent,
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
  Election,
  ElectionRegisterPublicKeySet,
  ElectionResultsPublished,
  ElectionStatusChanged,
  OwnershipTransferred,
  VoteCast,
  VoteUpdated,
  VoterAuthorized,
  VoterRegistered,
  VotersAuthorized,
  VotersRegistered
} from "../generated/schema"

import { ipfs, log } from "@graphprotocol/graph-ts"

import {
  BigInt,
} from "@graphprotocol/graph-ts";

export function handleElectionCanceled(event: ElectionCanceledEvent): void {
  let entity = new ElectionCanceled(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.electionID = event.params.electionID
  entity.cancelReasonIPFSCID = event.params.cancelReasonIPFSCID

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleElectionCreated(event: ElectionCreatedEvent): void {
  let entity = new Election(
    event.params.electionID.toString()
  )
  entity.startTime = event.params.startTime
  entity.endTime = event.params.endTime
  entity.registerId = event.params.registerId
  entity.authProviderId = event.params.authProviderId
  entity.svsId = event.params.svsId
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.authorizedVoterCount = BigInt.fromI32(0)
  entity.registeredVoterCount = BigInt.fromI32(0)
  entity.totalVotes = BigInt.fromI32(0)
  entity.status = 0
  entity.descriptionCID = event.params.descriptionIPFSCID
  entity.publicKey = event.params.publicKey

  const ipfsBlob = ipfs.cat(event.params.descriptionIPFSCID);

  if (ipfsBlob !== null) {
    entity.descriptionBlob = ipfsBlob.toString();
  } else {
    entity.descriptionBlob = ""
  }

  entity.save()
}

export function handleElectionRegisterPublicKeySet(
  event: ElectionRegisterPublicKeySetEvent
): void {
  let entity = new ElectionRegisterPublicKeySet(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.electionID = event.params.electionID
  entity.n = event.params.n
  entity.e = event.params.e

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  // Update Election Entity
  const electionID = event.params.electionID.toString()
  let electionEntity = Election.load(electionID)
  if (electionEntity == null) {
    log.error("Election entity not found for ID: {}", [electionID])

    return
  }
  electionEntity.registerPublicKeyE = event.params.e
  electionEntity.registerPublicKeyN = event.params.n

  electionEntity.save()
}

export function handleElectionResultsPublished(
  event: ElectionResultsPublishedEvent
): void {
  let entity = new ElectionResultsPublished(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.electionID = event.params.electionID
  entity.privateKey = event.params.privateKey
  entity.yesVotes = event.params.yesVotes
  entity.noVotes = event.params.noVotes
  entity.invalidVotes = event.params.invalidVotes

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  // Update Election Entity

  const electionID = event.params.electionID.toString()
  let electionEntity = Election.load(electionID)
  if (electionEntity == null) {
    log.error("Election entity not found for ID: {}", [electionID])

    return
  }

  electionEntity.status = 3
  electionEntity.privateKey = event.params.privateKey
  electionEntity.save()

}

export function handleElectionStatusChanged(
  event: ElectionStatusChangedEvent
): void {
  let entity = new ElectionStatusChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.electionID = event.params.electionID
  entity.oldStatus = event.params.oldStatus
  entity.newStatus = event.params.newStatus

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  // Update Election Entity

  const electionID = event.params.electionID.toString()
  let electionEntity = Election.load(electionID)
  if (electionEntity == null) {
    log.error("Election entity not found for ID: {}", [electionID])

    return
  }

  electionEntity.status = event.params.newStatus
  electionEntity.save()
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
  entity.electionID = event.params.electionID
  entity.voter = event.params.voter
  entity.svsSignature = event.params.svsSignature
  entity.vote_encrypted = event.params.vote_encrypted
  entity.vote_encrypted_user = event.params.vote_encrypted_user
  entity.unblindedElectionToken = event.params.unblindedElectionToken
  entity.unblindedSignature = event.params.unblindedSignature

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  // Update Election Entity

  const electionID = event.params.electionID.toString()
  let electionEntity = Election.load(electionID)
  if (electionEntity == null) {
    log.error("Election entity not found for ID: {}", [electionID])

    return
  }

  if (!electionEntity.totalVotes) {
    electionEntity.totalVotes = BigInt.fromI32(0);
  }
  electionEntity.totalVotes = electionEntity.totalVotes!.plus(BigInt.fromI32(1))
  electionEntity.save()
}

export function handleVoteUpdated(event: VoteUpdatedEvent): void {
  let entity = new VoteUpdated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.electionID = event.params.electionID
  entity.voter = event.params.voter
  entity.vote_encrypted = event.params.vote_encrypted
  entity.vote_encrypted_user = event.params.vote_encrypted_user

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleVoterAuthorized(event: VoterAuthorizedEvent): void {
  let entity = new VoterAuthorized(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.apID = event.params.apID
  entity.electionID = event.params.electionID
  entity.voterID = event.params.voterID

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  // Update Election Entity

  const electionID = event.params.electionID.toString()
  let electionEntity = Election.load(electionID)
  if (electionEntity == null) {
    log.error("Election entity not found for ID: {}", [electionID])

    return
  }

  if (!electionEntity.authorizedVoterCount) {
    electionEntity.authorizedVoterCount = BigInt.fromI32(0);
  }

  electionEntity.authorizedVoterCount = electionEntity.authorizedVoterCount!.plus(BigInt.fromI32(1))

  electionEntity.save()
}

export function handleVoterRegistered(event: VoterRegisteredEvent): void {
  let entity = new VoterRegistered(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.registerID = event.params.registerID
  entity.electionID = event.params.electionID
  entity.voterID = event.params.voterID
  entity.blindedSignature = event.params.blindedSignature
  entity.blindedElectionToken = event.params.blindedElectionToken

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  // Update Election Entity

  const electionID = event.params.electionID.toString()
  let electionEntity = Election.load(electionID)
  if (electionEntity == null) {
    log.error("Election entity not found for ID: {}", [electionID])

    return
  }

  if (!electionEntity.registeredVoterCount) {
    electionEntity.registeredVoterCount = BigInt.fromI32(0);
  }
  electionEntity.registeredVoterCount = electionEntity.registeredVoterCount!.plus(BigInt.fromI32(1))
  electionEntity.save()
}

export function handleVotersAuthorized(event: VotersAuthorizedEvent): void {
  let entity = new VotersAuthorized(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.apID = event.params.apID
  entity.electionID = event.params.electionID
  entity.voterIDs = event.params.voterIDs

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  // Update Election Entity

  let electionID = event.params.electionID.toString();
  let electionEntity = Election.load(electionID);
  if (electionEntity == null) {
    log.error("Election entity not found for ID: {}", [electionID]);
    return;
  }

  let numberOfVotersAuthorized = event.params.voterIDs.length;
  if (!electionEntity.authorizedVoterCount) {
    electionEntity.authorizedVoterCount = BigInt.fromI32(0);
  }
  electionEntity.authorizedVoterCount = electionEntity.authorizedVoterCount!.plus(BigInt.fromI32(numberOfVotersAuthorized));
  electionEntity.save();
}

export function handleVotersRegistered(event: VotersRegisteredEvent): void {
  let entity = new VotersRegistered(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.registerID = event.params.registerID
  entity.electionID = event.params.electionID
  entity.voterIDs = event.params.voterIDs
  entity.blindedSignatures = event.params.blindedSignatures
  entity.blindedElectionTokens = event.params.blindedElectionTokens

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()


  // Update Election Entity

  let electionID = event.params.electionID.toString();
  let electionEntity = Election.load(electionID);
  if (electionEntity == null) {
    log.error("Election entity not found for ID: {}", [electionID]);
    return;
  }

  let numberOfVotersRegistered = event.params.voterIDs.length;
  if (!electionEntity.registeredVoterCount) {
    electionEntity.registeredVoterCount = BigInt.fromI32(0);
  }
  electionEntity.registeredVoterCount = electionEntity.registeredVoterCount!.plus(BigInt.fromI32(numberOfVotersRegistered));
  electionEntity.save();
}
