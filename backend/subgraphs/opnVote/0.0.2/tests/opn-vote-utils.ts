import { newMockEvent } from "matchstick-as"
import { ethereum, BigInt, Bytes, Address } from "@graphprotocol/graph-ts"
import {
  ElectionCanceled,
  ElectionCreated,
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
} from "../generated/OpnVote/OpnVote"

export function createElectionCanceledEvent(
  electionID: BigInt,
  cancelReasonIPFSCID: string
): ElectionCanceled {
  let electionCanceledEvent = changetype<ElectionCanceled>(newMockEvent())

  electionCanceledEvent.parameters = new Array()

  electionCanceledEvent.parameters.push(
    new ethereum.EventParam(
      "electionID",
      ethereum.Value.fromUnsignedBigInt(electionID)
    )
  )
  electionCanceledEvent.parameters.push(
    new ethereum.EventParam(
      "cancelReasonIPFSCID",
      ethereum.Value.fromString(cancelReasonIPFSCID)
    )
  )

  return electionCanceledEvent
}

export function createElectionCreatedEvent(
  electionID: BigInt,
  startTime: BigInt,
  endTime: BigInt,
  registerId: i32,
  authProviderId: i32,
  svsId: i32,
  descriptionIPFSCID: string,
  publicKey: Bytes
): ElectionCreated {
  let electionCreatedEvent = changetype<ElectionCreated>(newMockEvent())

  electionCreatedEvent.parameters = new Array()

  electionCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "electionID",
      ethereum.Value.fromUnsignedBigInt(electionID)
    )
  )
  electionCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "startTime",
      ethereum.Value.fromUnsignedBigInt(startTime)
    )
  )
  electionCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "endTime",
      ethereum.Value.fromUnsignedBigInt(endTime)
    )
  )
  electionCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "registerId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(registerId))
    )
  )
  electionCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "authProviderId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(authProviderId))
    )
  )
  electionCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "svsId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(svsId))
    )
  )
  electionCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "descriptionIPFSCID",
      ethereum.Value.fromString(descriptionIPFSCID)
    )
  )
  electionCreatedEvent.parameters.push(
    new ethereum.EventParam("publicKey", ethereum.Value.fromBytes(publicKey))
  )

  return electionCreatedEvent
}

export function createElectionRegisterPublicKeySetEvent(
  electionID: BigInt,
  n: Bytes,
  e: Bytes
): ElectionRegisterPublicKeySet {
  let electionRegisterPublicKeySetEvent =
    changetype<ElectionRegisterPublicKeySet>(newMockEvent())

  electionRegisterPublicKeySetEvent.parameters = new Array()

  electionRegisterPublicKeySetEvent.parameters.push(
    new ethereum.EventParam(
      "electionID",
      ethereum.Value.fromUnsignedBigInt(electionID)
    )
  )
  electionRegisterPublicKeySetEvent.parameters.push(
    new ethereum.EventParam("n", ethereum.Value.fromBytes(n))
  )
  electionRegisterPublicKeySetEvent.parameters.push(
    new ethereum.EventParam("e", ethereum.Value.fromBytes(e))
  )

  return electionRegisterPublicKeySetEvent
}

export function createElectionResultsPublishedEvent(
  electionID: BigInt,
  privateKey: Bytes,
  yesVotes: BigInt,
  noVotes: BigInt,
  invalidVotes: BigInt
): ElectionResultsPublished {
  let electionResultsPublishedEvent =
    changetype<ElectionResultsPublished>(newMockEvent())

  electionResultsPublishedEvent.parameters = new Array()

  electionResultsPublishedEvent.parameters.push(
    new ethereum.EventParam(
      "electionID",
      ethereum.Value.fromUnsignedBigInt(electionID)
    )
  )
  electionResultsPublishedEvent.parameters.push(
    new ethereum.EventParam("privateKey", ethereum.Value.fromBytes(privateKey))
  )
  electionResultsPublishedEvent.parameters.push(
    new ethereum.EventParam(
      "yesVotes",
      ethereum.Value.fromUnsignedBigInt(yesVotes)
    )
  )
  electionResultsPublishedEvent.parameters.push(
    new ethereum.EventParam(
      "noVotes",
      ethereum.Value.fromUnsignedBigInt(noVotes)
    )
  )
  electionResultsPublishedEvent.parameters.push(
    new ethereum.EventParam(
      "invalidVotes",
      ethereum.Value.fromUnsignedBigInt(invalidVotes)
    )
  )

  return electionResultsPublishedEvent
}

export function createElectionStatusChangedEvent(
  electionID: BigInt,
  oldStatus: i32,
  newStatus: i32
): ElectionStatusChanged {
  let electionStatusChangedEvent =
    changetype<ElectionStatusChanged>(newMockEvent())

  electionStatusChangedEvent.parameters = new Array()

  electionStatusChangedEvent.parameters.push(
    new ethereum.EventParam(
      "electionID",
      ethereum.Value.fromUnsignedBigInt(electionID)
    )
  )
  electionStatusChangedEvent.parameters.push(
    new ethereum.EventParam(
      "oldStatus",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(oldStatus))
    )
  )
  electionStatusChangedEvent.parameters.push(
    new ethereum.EventParam(
      "newStatus",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(newStatus))
    )
  )

  return electionStatusChangedEvent
}

export function createOwnershipTransferredEvent(
  previousOwner: Address,
  newOwner: Address
): OwnershipTransferred {
  let ownershipTransferredEvent =
    changetype<OwnershipTransferred>(newMockEvent())

  ownershipTransferredEvent.parameters = new Array()

  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam(
      "previousOwner",
      ethereum.Value.fromAddress(previousOwner)
    )
  )
  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return ownershipTransferredEvent
}

export function createVoteCastEvent(
  electionID: BigInt,
  voter: Address,
  svsSignature: Bytes,
  vote_encrypted: Bytes,
  vote_encrypted_user: Bytes,
  unblindedElectionToken: Bytes,
  unblindedSignature: Bytes
): VoteCast {
  let voteCastEvent = changetype<VoteCast>(newMockEvent())

  voteCastEvent.parameters = new Array()

  voteCastEvent.parameters.push(
    new ethereum.EventParam(
      "electionID",
      ethereum.Value.fromUnsignedBigInt(electionID)
    )
  )
  voteCastEvent.parameters.push(
    new ethereum.EventParam("voter", ethereum.Value.fromAddress(voter))
  )
  voteCastEvent.parameters.push(
    new ethereum.EventParam(
      "svsSignature",
      ethereum.Value.fromBytes(svsSignature)
    )
  )
  voteCastEvent.parameters.push(
    new ethereum.EventParam(
      "vote_encrypted",
      ethereum.Value.fromBytes(vote_encrypted)
    )
  )
  voteCastEvent.parameters.push(
    new ethereum.EventParam(
      "vote_encrypted_user",
      ethereum.Value.fromBytes(vote_encrypted_user)
    )
  )
  voteCastEvent.parameters.push(
    new ethereum.EventParam(
      "unblindedElectionToken",
      ethereum.Value.fromBytes(unblindedElectionToken)
    )
  )
  voteCastEvent.parameters.push(
    new ethereum.EventParam(
      "unblindedSignature",
      ethereum.Value.fromBytes(unblindedSignature)
    )
  )

  return voteCastEvent
}

export function createVoteUpdatedEvent(
  electionID: BigInt,
  voter: Address,
  vote_encrypted: Bytes,
  vote_encrypted_user: Bytes
): VoteUpdated {
  let voteUpdatedEvent = changetype<VoteUpdated>(newMockEvent())

  voteUpdatedEvent.parameters = new Array()

  voteUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "electionID",
      ethereum.Value.fromUnsignedBigInt(electionID)
    )
  )
  voteUpdatedEvent.parameters.push(
    new ethereum.EventParam("voter", ethereum.Value.fromAddress(voter))
  )
  voteUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "vote_encrypted",
      ethereum.Value.fromBytes(vote_encrypted)
    )
  )
  voteUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "vote_encrypted_user",
      ethereum.Value.fromBytes(vote_encrypted_user)
    )
  )

  return voteUpdatedEvent
}

export function createVoterAuthorizedEvent(
  apID: i32,
  electionID: BigInt,
  voterID: BigInt
): VoterAuthorized {
  let voterAuthorizedEvent = changetype<VoterAuthorized>(newMockEvent())

  voterAuthorizedEvent.parameters = new Array()

  voterAuthorizedEvent.parameters.push(
    new ethereum.EventParam(
      "apID",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(apID))
    )
  )
  voterAuthorizedEvent.parameters.push(
    new ethereum.EventParam(
      "electionID",
      ethereum.Value.fromUnsignedBigInt(electionID)
    )
  )
  voterAuthorizedEvent.parameters.push(
    new ethereum.EventParam(
      "voterID",
      ethereum.Value.fromUnsignedBigInt(voterID)
    )
  )

  return voterAuthorizedEvent
}

export function createVoterRegisteredEvent(
  registerID: i32,
  electionID: BigInt,
  voterID: BigInt,
  blindedSignature: Bytes,
  blindedElectionToken: Bytes
): VoterRegistered {
  let voterRegisteredEvent = changetype<VoterRegistered>(newMockEvent())

  voterRegisteredEvent.parameters = new Array()

  voterRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "registerID",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(registerID))
    )
  )
  voterRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "electionID",
      ethereum.Value.fromUnsignedBigInt(electionID)
    )
  )
  voterRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "voterID",
      ethereum.Value.fromUnsignedBigInt(voterID)
    )
  )
  voterRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "blindedSignature",
      ethereum.Value.fromBytes(blindedSignature)
    )
  )
  voterRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "blindedElectionToken",
      ethereum.Value.fromBytes(blindedElectionToken)
    )
  )

  return voterRegisteredEvent
}

export function createVotersAuthorizedEvent(
  apID: i32,
  electionID: BigInt,
  voterIDs: Array<BigInt>
): VotersAuthorized {
  let votersAuthorizedEvent = changetype<VotersAuthorized>(newMockEvent())

  votersAuthorizedEvent.parameters = new Array()

  votersAuthorizedEvent.parameters.push(
    new ethereum.EventParam(
      "apID",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(apID))
    )
  )
  votersAuthorizedEvent.parameters.push(
    new ethereum.EventParam(
      "electionID",
      ethereum.Value.fromUnsignedBigInt(electionID)
    )
  )
  votersAuthorizedEvent.parameters.push(
    new ethereum.EventParam(
      "voterIDs",
      ethereum.Value.fromUnsignedBigIntArray(voterIDs)
    )
  )

  return votersAuthorizedEvent
}

export function createVotersRegisteredEvent(
  registerID: i32,
  electionID: BigInt,
  voterIDs: Array<BigInt>,
  blindedSignatures: Array<Bytes>,
  blindedElectionTokens: Array<Bytes>
): VotersRegistered {
  let votersRegisteredEvent = changetype<VotersRegistered>(newMockEvent())

  votersRegisteredEvent.parameters = new Array()

  votersRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "registerID",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(registerID))
    )
  )
  votersRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "electionID",
      ethereum.Value.fromUnsignedBigInt(electionID)
    )
  )
  votersRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "voterIDs",
      ethereum.Value.fromUnsignedBigIntArray(voterIDs)
    )
  )
  votersRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "blindedSignatures",
      ethereum.Value.fromBytesArray(blindedSignatures)
    )
  )
  votersRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "blindedElectionTokens",
      ethereum.Value.fromBytesArray(blindedElectionTokens)
    )
  )

  return votersRegisteredEvent
}
