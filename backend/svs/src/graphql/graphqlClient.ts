import { GraphQLClient, gql } from 'graphql-request';
import { ElectionRegisterPublicKeyResponse, ElectionStatusResponse } from '../types/graphql';
import { getEnvVar } from '../utils/utils';

const endpoint = getEnvVar<string>('GRAPHQL_ENDPOINT', 'string');

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


/**
 * Fetches the Register Public Key for a given election ID.
 *
 * @param {number} electionId - Identifier of election.
 * @return {Promise<ElectionRegisterPublicKeyResponse | null>} Resolves to RSA Public Key components (E, N) or null if election not found.
 */
export async function fetchElectionRegisterPublicKey(electionId: number): Promise<ElectionRegisterPublicKeyResponse | null> {
  const query = gql`
      query GetElectionRegisterPublicKey($id: ID!) {
        election(id: $id) {
          registerPublicKeyE,
          registerPublicKeyN,
        }
      }
    `;

  const variables = { id: electionId };

  try {
    const response: { election: ElectionRegisterPublicKeyResponse | null } = await client.request(query, variables);
    return response.election;
  } catch (error) {
    console.error('GraphQL Error:', (error as Error).message);
    throw error;
  }
}

