import { GraphQLClient, gql } from 'graphql-request';
import { ElectionStatusResponse } from '../types/graphql';
import { logger } from '../utils/logger';

const endpoint = process.env.GRAPHQL_ENDPOINT;

if (!endpoint) {
  throw new Error('GRAPHQL_ENDPOINT is not defined in the environment variables');
}

// Initialize new GraphQL client
const client = new GraphQLClient(endpoint);

/**
 * Fetches the election status and end time for a given election ID using GraphQL.
 * 
 * @param {number} electionId - Identifier of election.
 * @return {Promise<ElectionStatusResponse | null>} Resolves to current on-chain election status and end time, or null if election not found.
 */
export async function fetchElectionEndTimeStatus(electionId: number): Promise<ElectionStatusResponse | null> {
  const query = gql`
    query GetElectionStatus($id: ID!) {
      election(id: $id) {
        status,
        endTime,
      }
    }
  `;

  const variables = { id: electionId };

  try {
    const response: { election: ElectionStatusResponse | null } = await client.request(query, variables);
    return response.election;
  } catch (error) {
    logger.error(`GraphQL Error: ${error}`);
    throw error;
  }
}

export interface RecentRegistrationResponse {
  votersRegistereds: {
    voterIDs: string[];
    blindedSignatures: string[];
    blindedElectionTokens: string[];
  }[];
}

/**
 * Fetches recent voter registrations for a given election ID using GraphQL.
 * 
 * @param {string} electionID - Identifier of election.
 * @param {number} limit - Number of recent registrations to fetch (default: 10).
 * @return {Promise<RecentRegistrationResponse>} Resolves to an array of registration entries, 
 *         each containing arrays of voterIDs, blindedSignatures, and blindedElectionTokens.
 *         Results are ordered by blockTimestamp in descending order.
 */
export async function fetchRecentRegistrations(electionID: string, limit: number = 10): Promise<RecentRegistrationResponse> {
  const query = gql`
    query CheckRecentVoterIDs($electionID: String!, $first: Int!) {
      votersRegistereds(
        where: { electionID: $electionID }
        orderBy: blockTimestamp
        orderDirection: desc
        first: $first
      ) {
        voterIDs
        blindedSignatures
        blindedElectionTokens
      }
    }
  `;

  const variables = {
    electionID,
    first: limit
  };

  try {
    const response: RecentRegistrationResponse = await client.request(query, variables);
    return response;
  } catch (error) {
    logger.error(`GraphQL Error: ${error}`);
    throw error;
  }
}