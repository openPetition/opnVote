// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

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
    string apUri;
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
    string svsUri;
}

struct Register {
    uint8 id;
    address owner;
    string registerName;
    string registerUri;
}

struct Election {
    uint256 electionId;
    uint256 votingStartTime;
    uint256 votingEndTime;
    uint256 totalVotes;
    uint256 totalAuthorized;
    uint256 totalRegistered;
    uint8 registerId;
    uint8 authProviderId;
    uint8 svsId;
    ElectionStatus status;
    // ElectionResult[] results;
    mapping(address => bool) hasVoted;
    string cancelReasonIpfsCid;
    string descriptionIpfsCid;
    bytes publicKey;
    bytes privateKey;
    RsaPublicKeyRaw registerPubKey;
}

struct RsaPublicKeyRaw {
    bytes n; //  RSA modulus
    bytes e; // RSA public exponent
}
