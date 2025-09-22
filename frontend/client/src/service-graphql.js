'use client'

import { useLazyQuery, gql } from '@apollo/client';

const GET_ELECTION = gql`
query election($id: ID!) {
    election(id: $id)  {
        id,
        votingStartTime,
        votingEndTime,
        registrationEndTime,
        registrationStartTime,
        transactionHash,
        totalVotes,
        registeredVoterCount,
        authorizedVoterCount,
        status,
        registerPublicKeyE,
        registerPublicKeyN,
        privateKey,
        descriptionIpfsCid, # ist nun dynamisch
        descriptionBlob, # ist nun dynamisch
        publicKey, # hinzugefuegt
    }
}`;

// two queries in one call to prevent more request and hooks
const GET_VOTECASTS = gql`
query getVoteCasts($voter: String!, $electionId: ID!) {
    voteCasts(where: { voter: $voter, electionId: $electionId }) {
        id 
    }
    voteUpdateds(where: { voter: $voter, electionId: $electionId }) {
        id
    }   
}`;

export function getElectionData(electionId) {
    return useLazyQuery(GET_ELECTION, { variables: { id: electionId } })
}

export function getVoteCastsData(voterAddress, electionId) {
    return useLazyQuery(GET_VOTECASTS, { variables: { voter: voterAddress, electionId: electionId }, fetchPolicy: "cache-and-network", })
}