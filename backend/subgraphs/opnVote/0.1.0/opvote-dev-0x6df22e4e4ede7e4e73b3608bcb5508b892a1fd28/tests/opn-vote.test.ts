import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { BigInt, Bytes, Address } from "@graphprotocol/graph-ts"
import { ElectionCanceled } from "../generated/schema"
import { ElectionCanceled as ElectionCanceledEvent } from "../generated/OpnVote/OpnVote"
import { handleElectionCanceled } from "../src/opn-vote"
import { createElectionCanceledEvent } from "./opn-vote-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#tests-structure

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let electionId = BigInt.fromI32(234)
    let cancelReasonIpfsCid = "Example string value"
    let newElectionCanceledEvent = createElectionCanceledEvent(
      electionId,
      cancelReasonIpfsCid
    )
    handleElectionCanceled(newElectionCanceledEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

  test("ElectionCanceled created and stored", () => {
    assert.entityCount("ElectionCanceled", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "ElectionCanceled",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "electionId",
      "234"
    )
    assert.fieldEquals(
      "ElectionCanceled",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "cancelReasonIpfsCid",
      "Example string value"
    )

    // More assert options:
    // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#asserts
  })
})
