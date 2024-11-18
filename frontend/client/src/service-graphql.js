'use client'


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
    return useLazyQuery(GET_ELECTION, { variables: { id: electionId } })
}
