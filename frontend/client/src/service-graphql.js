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

// two queries in one call to prevent more request and hooks
const GET_VOTECASTS = gql`
query getVoteCasts($voter: String!, $electionID: ID!) {
    voteCasts(where: { voter: $voter, electionID: $electionID }) {
        id 
    }
    voteUpdateds(where: { voter: $voter, electionID: $electionID }) {
        id
    }   
}`;

export function getElectionData(electionId) {
    return useLazyQuery(GET_ELECTION, { variables: { id: electionId } })
}

export function getVoteCastsData(voterAddress, electionId) {
    return useLazyQuery(GET_VOTECASTS, { variables: { voter: voterAddress, electionID: electionId } })
}