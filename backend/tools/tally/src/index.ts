import dotenv from 'dotenv'
dotenv.config()

import { ethers } from 'ethers'
import { GraphQLClient, gql } from 'graphql-request'
import { logger } from './utils/logger'
import { getEnvVar } from './utils/utils'
import opnvoteAbi from './abis/opnvote-0.1.0.json'
import {
  decryptVotes,
  EncryptedVotes,
  EncryptionKey,
  EncryptionType,
  VoteOption,
} from 'votingsystem'
const GRAPHQL_ENDPOINT = getEnvVar<string>('GRAPHQL_ENDPOINT', 'string')
const RPC_PROVIDER = getEnvVar<string>('RPC_PROVIDER', 'string')
const OPNVOTE_CONTRACT_ADDRESS = getEnvVar<string>('OPNVOTE_CONTRACT_ADDRESS', 'string')
const ELECTION_ID = getEnvVar<number>('ELECTION_ID', 'number')
const VERSION = getEnvVar<string>('VERSION', 'string')
const NUMBER_OF_QUESTIONS = getEnvVar<number>('NUMBER_OF_QUESTIONS', 'number')

let ELECTION_PRIVATE_KEY_FROM_ENV: string | undefined
try {
  ELECTION_PRIVATE_KEY_FROM_ENV = getEnvVar<string>('ELECTION_PRIVATE_KEY', 'string')
} catch (error) {
  ELECTION_PRIVATE_KEY_FROM_ENV = undefined
}

const ELECTION_STATUS_NAMES = ['Pending', 'Active', 'Ended', 'ResultsPublished', 'Canceled']

interface VoteEntry {
  voter: string
  voteType: 'cast' | 'recast'
  blockNumber: bigint
  voteEncrypted: string
}

async function main() {
  logger.info('OpnVote Tally Tool initialized')
  logger.info(`Starting tally for election ID: ${ELECTION_ID}`)

  const warnings: string[] = []
  const errors: string[] = []

  const provider = new ethers.JsonRpcProvider(RPC_PROVIDER)
  const contract = new ethers.Contract(OPNVOTE_CONTRACT_ADDRESS, opnvoteAbi, provider)

  logger.info('Fetching contract version...')
  const contractVersion = await contract.VERSION()
  if (contractVersion !== VERSION) {
    logger.error(`Contract version mismatch! Expected: ${VERSION}, Got: ${contractVersion}`)
    throw new Error('Contract version mismatch')
  }

  logger.info(`Fetching election data for election ID: ${ELECTION_ID}`)
  const election = await contract.elections(ELECTION_ID)
  logger.info('Election data fetched successfully')

  if (Number(election.totalRegistered) > Number(election.totalAuthorized)) {
    const msg = `ERROR: Total registered (${election.totalRegistered}) exceeds total authorized (${election.totalAuthorized})`
    logger.error(msg)
    errors.push(msg)
  }

  if (Number(election.totalVotes) > Number(election.totalAuthorized)) {
    const msg = `ERROR: Total votes (${election.totalVotes}) exceeds total authorized (${election.totalAuthorized})`
    logger.error(msg)
    errors.push(msg)
  }

  if (Number(election.totalVotes) > Number(election.totalRegistered)) {
    const msg = `ERROR: Total votes (${election.totalVotes}) exceeds total registered (${election.totalRegistered})`
    logger.error(msg)
    errors.push(msg)
  }

  if (election.status !== 2) {
    // 2 == Open
    const msg = `WARNING: Election status is ${
      ELECTION_STATUS_NAMES[election.status] || election.status
    }, expected "Ended" (2)`
    logger.warn(msg)
    warnings.push(msg)
  }

  if (!election.privateKey || election.privateKey === '0x') {
    const msg = `WARNING: Election private key is not published within the contract`
    logger.warn(msg)
    warnings.push(msg)
  }

  if (!ELECTION_PRIVATE_KEY_FROM_ENV) {
    const msg = `WARNING: ELECTION_PRIVATE_KEY not provided. Using private Key retrieved from contract instead`
    logger.warn(msg)
    warnings.push(msg)
  }

  if (
    ELECTION_PRIVATE_KEY_FROM_ENV &&
    election.privateKey &&
    election.privateKey !== '0x' &&
    ELECTION_PRIVATE_KEY_FROM_ENV !== election.privateKey
  ) {
    const msg = `ERROR: Election private key mismatch. Key provided does not match on-chain key`
    logger.error(msg)
    errors.push(msg)
    throw new Error('Private key mismatch between .env and contract')
  }

  const privateKeyToUse = ELECTION_PRIVATE_KEY_FROM_ENV || election.privateKey
  if (privateKeyToUse && privateKeyToUse !== '0x') {
    logger.info(`Using private key for decryption: ${privateKeyToUse.substring(0, 10)}...`)
  } else {
    logger.error('ERROR: No valid private key available for decryption')
    errors.push('No valid private key available for decryption')
  }

  logger.info('Fetching votes from GraphQL...')
  const graphqlClient = new GraphQLClient(GRAPHQL_ENDPOINT)

  const BATCH_SIZE = 1000
  const DELAY_MS = 2000

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const voteCastQuery = gql`
    query GetVoteCasts($electionId: BigInt!, $first: Int!, $skip: Int!) {
      voteCasts(
        where: { electionId: $electionId }
        orderBy: blockNumber
        orderDirection: asc
        first: $first
        skip: $skip
      ) {
        voter
        voteEncrypted
        blockNumber
      }
    }
  `

  const voteUpdatedQuery = gql`
    query GetVoteUpdated($electionId: BigInt!, $first: Int!, $skip: Int!) {
      voteUpdateds(
        where: { electionId: $electionId }
        orderBy: blockNumber
        orderDirection: asc
        first: $first
        skip: $skip
      ) {
        voter
        voteEncrypted
        blockNumber
      }
    }
  `

  const votesMap = new Map<string, VoteEntry>()

  logger.info('Fetching and processing VoteCast events ...')
  let skip = 0
  let totalVoteCasts = 0

  while (true) {
    const response: {
      voteCasts: Array<{
        voter: string
        voteEncrypted: string
        blockNumber: string
      }>
    } = await graphqlClient.request(voteCastQuery, {
      electionId: ELECTION_ID.toString(),
      first: BATCH_SIZE,
      skip,
    })

    for (const vote of response.voteCasts) {
      const voterAddress = vote.voter.toLowerCase()

      if (votesMap.has(voterAddress)) {
        const msg = `ERROR: Duplicate VoteCast found for voter ${voterAddress}. Should never happen!`
        logger.error(msg)
        throw new Error('Duplicate VoteCast found!')
      }

      votesMap.set(voterAddress, {
        voter: voterAddress,
        voteType: 'cast',
        blockNumber: BigInt(vote.blockNumber),
        voteEncrypted: vote.voteEncrypted,
      })
    }

    totalVoteCasts += response.voteCasts.length
    logger.info(
      `  Fetched batch of ${response.voteCasts.length} vote casts (total: ${totalVoteCasts})`,
    )

    if (response.voteCasts.length < BATCH_SIZE) break

    skip += BATCH_SIZE
    await delay(DELAY_MS)
  }

  logger.info(`Processed ${totalVoteCasts} initial vote casts, ${votesMap.size} unique voters`)

  logger.info('Fetching and processing VoteUpdated events (recasts, ordered old->new)...')
  skip = 0
  let totalVoteRecasts = 0
  let replacedCount = 0

  while (true) {
    const response: {
      voteUpdateds: Array<{
        voter: string
        voteEncrypted: string
        blockNumber: string
      }>
    } = await graphqlClient.request(voteUpdatedQuery, {
      electionId: ELECTION_ID.toString(),
      first: BATCH_SIZE,
      skip,
    })

    for (const vote of response.voteUpdateds) {
      const voterAddress = vote.voter.toLowerCase()
      const blockNumber = BigInt(vote.blockNumber)

      const existing = votesMap.get(voterAddress)
      if (!existing) {
        const msg = `ERROR: VoteUpdated found for voter ${voterAddress} but no initial VoteCast exists. Should never happen!`
        logger.error(msg)
        throw new Error('VoteUpdated found but no initial VoteCast exists!')
      } else {
        replacedCount++
      }

      votesMap.set(voterAddress, {
        voter: voterAddress,
        voteType: 'recast',
        blockNumber,
        voteEncrypted: vote.voteEncrypted,
      })
    }

    totalVoteRecasts += response.voteUpdateds.length
    logger.info(
      `  Fetched batch of ${response.voteUpdateds.length} recasts (total: ${totalVoteRecasts})`,
    )

    if (response.voteUpdateds.length < BATCH_SIZE) break

    skip += BATCH_SIZE
    await delay(DELAY_MS)
  }

  logger.info(`Processed ${totalVoteRecasts} vote recasts, replaced ${replacedCount} initial votes`)

  logger.info(`Processed votes: ${votesMap.size} unique voters`)

  const expectedTotalVotes = Number(election.totalVotes)
  const actualTotalVotes = votesMap.size

  if (actualTotalVotes !== expectedTotalVotes) {
    logger.warn(`Vote count mismatch! Expected: ${expectedTotalVotes}, Got: ${actualTotalVotes}`)
    logger.info('Fetching election data...')

    const updatedElection = await contract.elections(ELECTION_ID)
    const updatedTotalVotes = Number(updatedElection.totalVotes)

    if (actualTotalVotes !== updatedTotalVotes) {
      const msg = `ERROR: Vote count mismatched! Expected: ${updatedTotalVotes}, Got: ${actualTotalVotes}}`
      logger.error(msg)
      errors.push(msg)
    } else {
      logger.info(`Vote count matches: ${actualTotalVotes} votes`)
    }
  } else {
    logger.info(`Vote count matches: ${actualTotalVotes} votes`)
  }

  if (!privateKeyToUse || privateKeyToUse === '0x') {
    logger.error('Unable to tally votes without a valid private key')
  } else {
    logger.info('Decrypting votes and tallying results...')

    const tallyByQuestion = new Map<number, Record<VoteOption, number>>()

    for (let questionId = 0; questionId < NUMBER_OF_QUESTIONS; questionId++) {
      tallyByQuestion.set(questionId, {
        [VoteOption.Yes]: 0,
        [VoteOption.No]: 0,
        [VoteOption.Abstain]: 0,
      })
    }

    const optionLabels: Record<VoteOption, string> = {
      [VoteOption.Yes]: 'Yes',
      [VoteOption.No]: 'No',
      [VoteOption.Abstain]: 'Abstain',
    }

    const privateKey: EncryptionKey = {
      hexString: privateKeyToUse,
      encryptionType: EncryptionType.RSA,
    }

    let successfullyDecrypted = 0
    let decryptionErrors = 0
    let invalidBallots = 0
    const failedDecryptionAddresses: string[] = []

    for (const vote of votesMap.values()) {
      const voteEncrypted: EncryptedVotes = {
        hexString: vote.voteEncrypted,
        encryptionType: EncryptionType.RSA,
      }

      try {
        const decryptedVotes = await decryptVotes(voteEncrypted, privateKey, EncryptionType.RSA)

        if (decryptedVotes.length !== NUMBER_OF_QUESTIONS) {
          invalidBallots++
          const msg = `ERROR: Invalid ballot from ${vote.voter}: has ${decryptedVotes.length} questions, expected ${NUMBER_OF_QUESTIONS}`
          logger.error(msg)
          errors.push(msg)
          continue
        }

        let ballotIsValid = true
        for (let questionId = 0; questionId < NUMBER_OF_QUESTIONS; questionId++) {
          const decryptedVote = decryptedVotes[questionId]
          if (
            typeof decryptedVote?.value !== 'number' ||
            VoteOption[decryptedVote.value as VoteOption] === undefined
          ) {
            ballotIsValid = false
            invalidBallots++
            const msg = `ERROR: Invalid vote value from ${
              vote.voter
            } for question ${questionId} - decrypted value: ${JSON.stringify(decryptedVote)}`
            logger.error(msg)
            errors.push(msg)
            break
          }
        }

        if (!ballotIsValid) {
          continue
        }

        successfullyDecrypted++

        for (let questionId = 0; questionId < NUMBER_OF_QUESTIONS; questionId++) {
          const decryptedVote = decryptedVotes[questionId]
          const questionTally = tallyByQuestion.get(questionId)!
          questionTally[decryptedVote.value as VoteOption]++
        }
      } catch (error) {
        decryptionErrors++
        failedDecryptionAddresses.push(vote.voter)
        const msg = `ERROR: Failed to decrypt vote for ${vote.voter}: ${
          error instanceof Error ? error.message : String(error)
        }`
        logger.error(msg)
        logger.error(`  Encrypted data (first 200 chars): ${vote.voteEncrypted.substring(0, 200)}`)
        logger.error(`  Block number: ${vote.blockNumber}, Vote type: ${vote.voteType}`)
        errors.push(msg)
      }
    }

    logger.info(`Total votes to decrypt: ${votesMap.size}`)
    logger.info(`Successfully decrypted: ${successfullyDecrypted}`)
    logger.info(`Decryption errors: ${decryptionErrors}`)
    logger.info(`Invalid ballots (decrypted but invalid): ${invalidBallots}`)

    const sortedQuestions = Array.from(tallyByQuestion.keys()).sort((a, b) => a - b)
    const expectedAnswersPerQuestion = successfullyDecrypted

    for (const questionId of sortedQuestions) {
      const questionTally = tallyByQuestion.get(questionId)!
      logger.info(`Question ${questionId}:`)
      logger.info(`  ${optionLabels[VoteOption.Yes]}: ${questionTally[VoteOption.Yes]}`)
      logger.info(`  ${optionLabels[VoteOption.No]}: ${questionTally[VoteOption.No]}`)
      logger.info(`  ${optionLabels[VoteOption.Abstain]}: ${questionTally[VoteOption.Abstain]}`)
      const total =
        questionTally[VoteOption.Yes] +
        questionTally[VoteOption.No] +
        questionTally[VoteOption.Abstain]
      logger.info(`  Total: ${total}`)

      if (total !== expectedAnswersPerQuestion) {
        const msg = `ERROR: Question ${questionId} has ${total} answers but expected ${expectedAnswersPerQuestion}`
        logger.error(`  ${msg}`)
        errors.push(msg)
      }
    }
    logger.info(`Expected answers per question: ${expectedAnswersPerQuestion}`)
    logger.info(`Number of questions: ${NUMBER_OF_QUESTIONS}`)

    let allQuestionsValid = true
    for (const questionId of sortedQuestions) {
      const questionTally = tallyByQuestion.get(questionId)!
      const total =
        questionTally[VoteOption.Yes] +
        questionTally[VoteOption.No] +
        questionTally[VoteOption.Abstain]

      logger.info(`  Q${questionId}: ${total}/${expectedAnswersPerQuestion} answers`)

      if (total !== expectedAnswersPerQuestion) {
        allQuestionsValid = false
      }
    }

    if (allQuestionsValid) {
      logger.info('All questions have the expected number of answers')
    } else {
      logger.warn('ERROR: Some questions have mismatched answer counts')
    }
  }

  logger.info(`Total Warnings: ${warnings.length}`)
  logger.info(`Total Errors: ${errors.length}`)

  if (warnings.length > 0) {
    logger.info('Warnings:')
    warnings.forEach((warning, index) => {
      logger.warn(`  ${index + 1}. ${warning}`)
    })
  }

  if (errors.length > 0) {
    logger.info('Errors:')
    errors.forEach((error, index) => {
      logger.error(`  ${index + 1}. ${error}`)
    })
  }
}

main().catch(error => {
  logger.error('Fatal error in vote tally tool:', error)
  process.exit(1)
})
