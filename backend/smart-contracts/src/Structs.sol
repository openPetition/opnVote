// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

enum ElectionStatus {
    Pending,
    Active,
    Ended,
    ResultsPublished,
    Canceled
}

struct AuthorizationProvider {
    uint8 id;
    address owner;
    string apName;
    string apURI;
}


// struct ElectionResult {
//     uint256 yesVotes;
//     uint256 noVotes;
//     uint256 invalidVotes;
// }

struct SignatureValidationServer {
    uint8 id;
    address owner;
    string svsName;
    string svsURI;
}

struct Register {
    uint8 id;
    address owner;
    string registerName;
    string registerURI;
}

struct Election {
    uint256 electionID;
    uint256 startTime;
    uint256 endTime;
    uint256 totalVotes;
    uint256 totalAuthorized;
    uint256 totalRegistered;
    uint8 registerID;
    uint8 authProviderId;
    uint8 svsId;
    uint8 ballotLength;
    ElectionStatus status;
    // ElectionResult[] results;
    mapping(address => bool) hasVoted;
    string ballotIPFSHash;
    string cancelReasonIPFSHash;
    string descriptionIPFSHash;
    bytes publicKey;
    bytes privateKey;
    bytes registerPubKey;
}
