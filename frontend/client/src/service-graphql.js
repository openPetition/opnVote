'use client'

export const graphConnectUrl = 'http://152.53.65.200:8000/subgraphs/name/opnvote-001';

import { useLazyQuery, gql } from '@apollo/client';

const GET_ELECTION = gql`
    query election($id: ID!) {
        election(id: $id)  {
            id,
            startTime,
            endTime,
            transactionHash,
            totalVotes,
            registeredVoterCount,
            authorizedVoterCount,
            status,
            registerPublicKeyE,
            registerPublicKeyN,
            privateKey,
            descriptionCID, # ist nun dynamisch
            descriptionBlob, # ist nun dynamisch
            publicKey, # hinzugefuegt
    }
}`;

export function getElectionData(electionId) {  
    const query = GET_ELECTION;
    return useLazyQuery(GET_ELECTION, { variables: { id: electionId } }) 
}
