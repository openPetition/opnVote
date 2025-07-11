import { newMockEvent } from "matchstick-as"
import { ethereum, BigInt, Bytes, Address } from "@graphprotocol/graph-ts"
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
} from "../generated/OpnVote/OpnVote"

export function createElectionCanceledEvent(
  electionId: BigInt,
  cancelReasonIpfsCid: string
): ElectionCanceled {
  let electionCanceledEvent = changetype<ElectionCanceled>(newMockEvent())

  electionCanceledEvent.parameters = new Array()

  electionCanceledEvent.parameters.push(
    new ethereum.EventParam(
      "electionId",
      ethereum.Value.fromUnsignedBigInt(electionId)
    )
  )
  electionCanceledEvent.parameters.push(
    new ethereum.EventParam(
      "cancelReasonIpfsCid",
      ethereum.Value.fromString(cancelReasonIpfsCid)
    )
  )

  return electionCanceledEvent
}

export function createElectionCreatedEvent(
  electionId: BigInt,
  votingStartTime: BigInt,
  votingEndTime: BigInt,
  registrationStartTime: BigInt,
  registrationEndTime: BigInt,
  registerId: i32,
  authProviderId: i32,
  svsId: i32,
  descriptionIpfsCid: string,
  publicKey: Bytes
): ElectionCreated {
  let electionCreatedEvent = changetype<ElectionCreated>(newMockEvent())

  electionCreatedEvent.parameters = new Array()

  electionCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "electionId",
      ethereum.Value.fromUnsignedBigInt(electionId)
    )
  )
  electionCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "votingStartTime",
      ethereum.Value.fromUnsignedBigInt(votingStartTime)
    )
  )
  electionCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "votingEndTime",
      ethereum.Value.fromUnsignedBigInt(votingEndTime)
    )
  )
  electionCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "registrationStartTime",
      ethereum.Value.fromUnsignedBigInt(registrationStartTime)
    )
  )
  electionCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "registrationEndTime",
      ethereum.Value.fromUnsignedBigInt(registrationEndTime)
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
      "descriptionIpfsCid",
      ethereum.Value.fromString(descriptionIpfsCid)
    )
  )
  electionCreatedEvent.parameters.push(
    new ethereum.EventParam("publicKey", ethereum.Value.fromBytes(publicKey))
  )

  return electionCreatedEvent
}

export function createElectionRegisterPublicKeySetEvent(
  electionId: BigInt,
  n: Bytes,
  e: Bytes
): ElectionRegisterPublicKeySet {
  let electionRegisterPublicKeySetEvent =
    changetype<ElectionRegisterPublicKeySet>(newMockEvent())

  electionRegisterPublicKeySetEvent.parameters = new Array()

  electionRegisterPublicKeySetEvent.parameters.push(
    new ethereum.EventParam(
      "electionId",
      ethereum.Value.fromUnsignedBigInt(electionId)
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
  electionId: BigInt,
  yesVotes: Array<BigInt>,
  noVotes: Array<BigInt>,
  invalidVotes: Array<BigInt>,
  privateKey: Bytes
): ElectionResultsPublished {
  let electionResultsPublishedEvent =
    changetype<ElectionResultsPublished>(newMockEvent())

  electionResultsPublishedEvent.parameters = new Array()

  electionResultsPublishedEvent.parameters.push(
    new ethereum.EventParam(
      "electionId",
      ethereum.Value.fromUnsignedBigInt(electionId)
    )
  )
  electionResultsPublishedEvent.parameters.push(
    new ethereum.EventParam(
      "yesVotes",
      ethereum.Value.fromUnsignedBigIntArray(yesVotes)
    )
  )
  electionResultsPublishedEvent.parameters.push(
    new ethereum.EventParam(
      "noVotes",
      ethereum.Value.fromUnsignedBigIntArray(noVotes)
    )
  )
  electionResultsPublishedEvent.parameters.push(
    new ethereum.EventParam(
      "invalidVotes",
      ethereum.Value.fromUnsignedBigIntArray(invalidVotes)
    )
  )
  electionResultsPublishedEvent.parameters.push(
    new ethereum.EventParam("privateKey", ethereum.Value.fromBytes(privateKey))
  )

  return electionResultsPublishedEvent
}

export function createElectionStatusChangedEvent(
  electionId: BigInt,
  oldStatus: i32,
  newStatus: i32
): ElectionStatusChanged {
  let electionStatusChangedEvent =
    changetype<ElectionStatusChanged>(newMockEvent())

  electionStatusChangedEvent.parameters = new Array()

  electionStatusChangedEvent.parameters.push(
    new ethereum.EventParam(
      "electionId",
      ethereum.Value.fromUnsignedBigInt(electionId)
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

export function createElectionUpdatedEvent(
  electionId: BigInt,
  votingStartTime: BigInt,
  votingEndTime: BigInt,
  registrationStartTime: BigInt,
  registrationEndTime: BigInt,
  registerId: i32,
  authProviderId: i32,
  svsId: i32,
  descriptionIpfsCid: string,
  publicKey: Bytes
): ElectionUpdated {
  let electionUpdatedEvent = changetype<ElectionUpdated>(newMockEvent())

  electionUpdatedEvent.parameters = new Array()

  electionUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "electionId",
      ethereum.Value.fromUnsignedBigInt(electionId)
    )
  )
  electionUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "votingStartTime",
      ethereum.Value.fromUnsignedBigInt(votingStartTime)
    )
  )
  electionUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "votingEndTime",
      ethereum.Value.fromUnsignedBigInt(votingEndTime)
    )
  )
  electionUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "registrationStartTime",
      ethereum.Value.fromUnsignedBigInt(registrationStartTime)
    )
  )
  electionUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "registrationEndTime",
      ethereum.Value.fromUnsignedBigInt(registrationEndTime)
    )
  )
  electionUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "registerId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(registerId))
    )
  )
  electionUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "authProviderId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(authProviderId))
    )
  )
  electionUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "svsId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(svsId))
    )
  )
  electionUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "descriptionIpfsCid",
      ethereum.Value.fromString(descriptionIpfsCid)
    )
  )
  electionUpdatedEvent.parameters.push(
    new ethereum.EventParam("publicKey", ethereum.Value.fromBytes(publicKey))
  )

  return electionUpdatedEvent
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
  electionId: BigInt,
  voter: Address,
  svsSignature: Bytes,
  voteEncrypted: Bytes,
  voteEncryptedUser: Bytes,
  unblindedElectionToken: Bytes,
  unblindedSignature: Bytes
): VoteCast {
  let voteCastEvent = changetype<VoteCast>(newMockEvent())

  voteCastEvent.parameters = new Array()

  voteCastEvent.parameters.push(
    new ethereum.EventParam(
      "electionId",
      ethereum.Value.fromUnsignedBigInt(electionId)
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
      "voteEncrypted",
      ethereum.Value.fromBytes(voteEncrypted)
    )
  )
  voteCastEvent.parameters.push(
    new ethereum.EventParam(
      "voteEncryptedUser",
      ethereum.Value.fromBytes(voteEncryptedUser)
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
  electionId: BigInt,
  voter: Address,
  voteEncrypted: Bytes,
  voteEncryptedUser: Bytes
): VoteUpdated {
  let voteUpdatedEvent = changetype<VoteUpdated>(newMockEvent())

  voteUpdatedEvent.parameters = new Array()

  voteUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "electionId",
      ethereum.Value.fromUnsignedBigInt(electionId)
    )
  )
  voteUpdatedEvent.parameters.push(
    new ethereum.EventParam("voter", ethereum.Value.fromAddress(voter))
  )
  voteUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "voteEncrypted",
      ethereum.Value.fromBytes(voteEncrypted)
    )
  )
  voteUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "voteEncryptedUser",
      ethereum.Value.fromBytes(voteEncryptedUser)
    )
  )

  return voteUpdatedEvent
}

export function createVoterAuthorizedEvent(
  apId: i32,
  electionId: BigInt,
  voterId: BigInt
): VoterAuthorized {
  let voterAuthorizedEvent = changetype<VoterAuthorized>(newMockEvent())

  voterAuthorizedEvent.parameters = new Array()

  voterAuthorizedEvent.parameters.push(
    new ethereum.EventParam(
      "apId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(apId))
    )
  )
  voterAuthorizedEvent.parameters.push(
    new ethereum.EventParam(
      "electionId",
      ethereum.Value.fromUnsignedBigInt(electionId)
    )
  )
  voterAuthorizedEvent.parameters.push(
    new ethereum.EventParam(
      "voterId",
      ethereum.Value.fromUnsignedBigInt(voterId)
    )
  )

  return voterAuthorizedEvent
}

export function createVoterRegisteredEvent(
  registerId: i32,
  electionId: BigInt,
  voterId: BigInt,
  blindedSignature: Bytes,
  blindedElectionToken: Bytes
): VoterRegistered {
  let voterRegisteredEvent = changetype<VoterRegistered>(newMockEvent())

  voterRegisteredEvent.parameters = new Array()

  voterRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "registerId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(registerId))
    )
  )
  voterRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "electionId",
      ethereum.Value.fromUnsignedBigInt(electionId)
    )
  )
  voterRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "voterId",
      ethereum.Value.fromUnsignedBigInt(voterId)
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
  apId: i32,
  electionId: BigInt,
  voterIds: Array<BigInt>
): VotersAuthorized {
  let votersAuthorizedEvent = changetype<VotersAuthorized>(newMockEvent())

  votersAuthorizedEvent.parameters = new Array()

  votersAuthorizedEvent.parameters.push(
    new ethereum.EventParam(
      "apId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(apId))
    )
  )
  votersAuthorizedEvent.parameters.push(
    new ethereum.EventParam(
      "electionId",
      ethereum.Value.fromUnsignedBigInt(electionId)
    )
  )
  votersAuthorizedEvent.parameters.push(
    new ethereum.EventParam(
      "voterIds",
      ethereum.Value.fromUnsignedBigIntArray(voterIds)
    )
  )

  return votersAuthorizedEvent
}

export function createVotersRegisteredEvent(
  registerId: i32,
  electionId: BigInt,
  voterIds: Array<BigInt>,
  blindedSignatures: Array<Bytes>,
  blindedElectionTokens: Array<Bytes>
): VotersRegistered {
  let votersRegisteredEvent = changetype<VotersRegistered>(newMockEvent())

  votersRegisteredEvent.parameters = new Array()

  votersRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "registerId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(registerId))
    )
  )
  votersRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "electionId",
      ethereum.Value.fromUnsignedBigInt(electionId)
    )
  )
  votersRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "voterIds",
      ethereum.Value.fromUnsignedBigIntArray(voterIds)
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
