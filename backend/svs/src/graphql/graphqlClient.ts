import { GraphQLClient, gql } from 'graphql-request'
import { ElectionRegisterPublicKeyResponse, ElectionStatusResponse } from '../types/graphql'
import { getEnvVar } from '../utils/utils'
import { logger } from '../utils/logger'

const endpoint = getEnvVar<string>('GRAPHQL_ENDPOINT', 'string')

// Initialize new GraphQL client
const client = new GraphQLClient(endpoint)

/**
 * Fetches the election status and end time for a given election ID using GraphQL.
 *
 * @param {number} electionId - Identifier of election.
 * @return {Promise<ElectionStatusResponse | null>} Resolves to current on-chain election status and end time, or null if election not found.
 */
export async function fetchElectionEndTimeStatus(
  electionId: number,
): Promise<ElectionStatusResponse | null> {
  const startTime = Date.now()
  logger.info(`[GraphQL] Starting election status fetch for election ${electionId}`)

  const query = gql`
    query GetElectionStatus($id: ID!) {
      election(id: $id) {
        status
        votingEndTime
      }
    }
  `

  const variables = { id: electionId }

  try {
    const response: { election: ElectionStatusResponse | null } = await client.request(
      query,
      variables,
    )
    const duration = Date.now() - startTime
    logger.info(
      `[GraphQL] Election status fetch completed in ${duration}ms for election ${electionId}`,
    )
    return response.election
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error(
      `[GraphQL] Error fetching election status after ${duration}ms for election ${electionId}: ${error}`,
    )
    throw error
  }
}

/**
 * Fetches the Register Public Key for a given election ID.
 *
 * @param {number} electionId - Identifier of election.
 * @return {Promise<ElectionRegisterPublicKeyResponse | null>} Resolves to RSA Public Key components (E, N) or null if election not found.
 */
export async function fetchElectionRegisterPublicKey(
  electionId: number,
): Promise<ElectionRegisterPublicKeyResponse | null> {
  const startTime = Date.now()
  logger.info(`[GraphQL] Starting register public key fetch for election ${electionId}`)

  const query = gql`
    query GetElectionRegisterPublicKey($id: ID!) {
      election(id: $id) {
        registerPublicKeyE
        registerPublicKeyN
      }
    }
  `

  const variables = { id: electionId }

  try {
    const response: { election: ElectionRegisterPublicKeyResponse | null } = await client.request(
      query,
      variables,
    )
    const duration = Date.now() - startTime
    logger.info(
      `[GraphQL] Register public key fetch completed in ${duration}ms for election ${electionId}`,
    )
    return response.election
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error(
      `[GraphQL] Error fetching register public key after ${duration}ms for election ${electionId}: ${error}`,
    )
    throw error
  }
}

/**
 * Checks if a vote exists on-chain for the given voter address and encrypted vote.
 *
 * @param {string} voterAddress - The voter wallet address.
 * @param {string} voteEncrypted - The encrypted vote.
 * @param {string} electionId - The election ID.
 * @return {Promise<string | null>} Resolves to transaction hash if vote exists on-chain, null otherwise.
 */
export async function checkVoteConfirmation(
  voterAddress: string,
  voteEncrypted: string,
  electionId: string,
): Promise<string | null> {
  const startTime = Date.now()
  logger.info(
    `[GraphQL] Checking if vote exists for voter ${voterAddress} in election ${electionId}`,
  )

  const query = gql`
    query CheckVoteCast($electionId: Bytes!, $voter: Bytes!, $voteEncrypted: Bytes!) {
      voteCasts(
        where: { electionId: $electionId, voter: $voter, voteEncrypted: $voteEncrypted }
        first: 1
      ) {
        transactionHash
      }
      voteUpdateds(
        where: { electionId: $electionId, voter: $voter, voteEncrypted: $voteEncrypted }
        first: 1
      ) {
        transactionHash
      }
    }
  `

  const variables = {
    electionId: electionId.toLowerCase(),
    voter: voterAddress.toLowerCase(),
    voteEncrypted: voteEncrypted.toLowerCase(),
  }

  try {
    const response: {
      voteCasts: Array<{ transactionHash: string }>
      voteUpdateds: Array<{ transactionHash: string }>
    } = await client.request(query, variables)
    const duration = Date.now() - startTime

    // Check voteCasts, then voteUpdateds
    let transactionHash: string | null = null
    if (response.voteCasts && response.voteCasts.length > 0) {
      transactionHash = response.voteCasts[0].transactionHash
    } else if (response.voteUpdateds && response.voteUpdateds.length > 0) {
      transactionHash = response.voteUpdateds[0].transactionHash
    }

    logger.info(
      `[GraphQL] Vote confirmation check completed in ${duration}ms for voter ${voterAddress}: ${
        transactionHash ? `found with tx ${transactionHash}` : 'not found'
      }`,
    )
    return transactionHash
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error(
      `[GraphQL] Error checking vote after ${duration}ms for voter ${voterAddress}: ${error}`,
    )
    throw error
  }
}
