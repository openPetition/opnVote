import { GraphQLClient, gql } from 'graphql-request';
import { ElectionStatusResponse } from '../types/graphql';

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
    console.error('GraphQL Error:', (error as Error).message);
    throw error;
  }
}
