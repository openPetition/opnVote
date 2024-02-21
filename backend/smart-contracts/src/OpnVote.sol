// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./Structs.sol";

contract OpnVote is Ownable(msg.sender) {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    mapping(uint8 => Register) public registers;
    mapping(uint8 => SignatureValidationServer) public svss;
    mapping(uint8 => AuthorizationProvider) public aps;
    Election[] public elections;

    //Events

    //AP Events
    event VoterAuthorized(uint256 indexed electionID, uint256 indexed voterID, uint8 indexed apID);
    event VotersAuthorized(uint256 indexed electionID, uint256[] voterIDs, uint8 indexed apID);

    //Register Events
    event VoterRegistered(
        uint256 indexed electionID,
        uint256 indexed voterID,
        uint8 indexed registerID,
        bytes blindedSignature,
        bytes blindedElectionToken
    );

    event VotersRegistered(
        uint256 indexed electionID,
        uint256[] voterIDs,
        uint8 indexed registerID,
        bytes blindedSignature,
        bytes blindedElectionToken
    );

    event ElectionRegisterKeySet(uint256 indexed electionID, bytes registerKey);

    //Voter Events
    event VoteCast(
        uint256 indexed electionID,
        address indexed voter,
        bytes svsSignature,
        bytes vote_encrypted,
        bytes unblindedElectionToken,
        bytes unblindedSignature
    );
    event VoteUpdated(uint256 indexed electionID, address indexed voter, bytes vote_encrypted);

    //Admin Events
    event ElectionCreated(
        uint256 indexed electionID,
        uint256 startTime,
        uint256 endTime,
        uint8 registerId,
        uint8 authProviderId,
        uint8 svsId,
        uint8 ballotLength,
        string descriptionIPFSHash,
        string ballotIPFSHash
    );
    event ElectionStatusChanged(
        uint256 indexed electionID, ElectionStatus oldStatus, ElectionStatus newStatus, string cancelReasonIPFS
    );

    event ElectionResultsPublished(
        uint256 indexed electionID, bytes privateKey, uint256[] yesVotes, uint256[] noVotes, uint256[] invalidVotes
    );

    //AP Functions
    // voterID will not be stored or validated onchain as register & Ap might publish them in no specific order
    function authorizeVoter(uint256 electionID, uint256 voterID) external {
        uint8 apID = elections[electionID].authProviderId;
        require(msg.sender == aps[apID].owner, "Only AP Owner");
        elections[electionID].totalAuthorized += 1;
        emit VoterAuthorized(electionID, voterID, apID);
    }

    function authorizeVoters(uint256 electionID, uint256[] calldata voterIDs) external {
        uint8 apID = elections[electionID].authProviderId;
        require(msg.sender == aps[apID].owner, "Only AP Owner");
        elections[electionID].totalAuthorized += voterIDs.length;
        emit VotersAuthorized(electionID, voterIDs, apID);
    }

    //Register Functions
    function registerVoter(
        uint256 electionID,
        uint256 voterID,
        bytes calldata blindedSignature,
        bytes calldata blindedElectionToken
    ) external {
        uint8 registerID = elections[electionID].registerID;
        require(msg.sender == registers[registerID].owner, "Only Register Owner");
        require(blindedSignature.length > 0, "Blinded Signature required"); //todo: Specify expected Length
        require(blindedElectionToken.length > 0, "Blinded Signature required"); //todo: Specify expected Length
        elections[electionID].totalRegistered += 1;

        emit VoterRegistered(electionID, voterID, registerID, blindedSignature, blindedElectionToken);
    }

    function registerVoters(
        uint256 electionID,
        uint256[] calldata voterIDs,
        bytes calldata blindedSignature,
        bytes calldata blindedElectionToken
    ) external {
        uint8 registerID = elections[electionID].registerID;
        require(msg.sender == registers[registerID].owner, "Only Register Owner");
        require(blindedSignature.length > 0, "Blinded Signature required"); //todo: Specify expected Length
        require(blindedElectionToken.length > 0, "Blinded Signature required"); //todo: Specify expected Length
        elections[electionID].totalRegistered += voterIDs.length;

        emit VotersRegistered(electionID, voterIDs, registerID, blindedSignature, blindedElectionToken);
    }

    function setElectionRegisterKey(uint256 electionID, bytes memory registerKey) external {
        uint8 registerID = elections[electionID].registerID;
        require(registers[registerID].owner == msg.sender, "Only Register");
        require(
            elections[electionID].status == ElectionStatus.Pending
                || elections[electionID].status == ElectionStatus.Active,
            "Election not active or pending"
        );
        elections[electionID].registerPubKey = registerKey;
        emit ElectionRegisterKeySet(electionID, registerKey);
    }

    // Voter Functions
    function vote(
        uint256 electionID,
        address voter,
        bytes calldata svsSignature,
        bytes calldata vote_encrypted,
        bytes calldata unblindedElectionToken,
        bytes calldata unblindedSignature
    ) external {
        Election storage election = elections[electionID];

        require(vote_encrypted.length > 0, "vote empty"); //todo: Specify expected Length
        require(election.status == ElectionStatus.Active, "Election is not active");
        require(election.endTime >= block.timestamp, "Election ended");

        if (svsSignature.length > 0) {
            address svsOwner = svss[election.svsId].owner;
            require(svsOwner != address(0), "SVS not specified");
            require(unblindedSignature.length > 0, "unblindedSignature empty"); //todo: Specify expected Length
            require(unblindedElectionToken.length > 0, "unblindedElectionToken empty"); //todo: Specify expected Length
            require(!election.hasVoted[voter], "Already voted");

            bool isValidSig = _verify(
                keccak256(
                    abi.encodePacked(electionID, voter, vote_encrypted, unblindedElectionToken, unblindedSignature)
                ),
                svsSignature,
                svsOwner
            );

            require(isValidSig, "Sig invalid");
            election.totalVotes += 1;
            election.hasVoted[voter] = true;

            //First vote
            emit VoteCast(electionID, voter, svsSignature, vote_encrypted, unblindedElectionToken, unblindedSignature);
        } else {
            //Vote recasting
            require(election.hasVoted[msg.sender], "voter unknown");
            emit VoteUpdated(electionID, msg.sender, vote_encrypted);
        }
    }

    //Admin Functions

    function addRegister(Register memory newRegister) external onlyOwner {
        require(registers[newRegister.id].owner == address(0), "ID already used");
        require(newRegister.owner != address(0), "No owner specified");
        registers[newRegister.id] = newRegister;
    }

    function addSVS(SignatureValidationServer memory newSVS) external onlyOwner {
        require(svss[newSVS.id].owner == address(0), "ID already used");
        require(newSVS.owner != address(0), "No owner specified");
        svss[newSVS.id] = newSVS;
    }

    function addAP(AuthorizationProvider memory newAP) external onlyOwner {
        require(aps[newAP.id].owner == address(0), "ID already used");
        require(newAP.owner != address(0), "No owner specified");
        aps[newAP.id] = newAP;
    }

    // Admin Election Functions

    function startElection(uint256 electionID) external onlyOwner {
        Election storage election = elections[electionID];
        require(election.startTime <= block.timestamp, "too early");
        require(election.endTime > block.timestamp, "too late");
        require(election.registerPubKey.length > 0, "Register Key required"); //todo: Specify expected Length
        ElectionStatus oldStatus = election.status;
        election.status = ElectionStatus.Active;
        emit ElectionStatusChanged(electionID, oldStatus, ElectionStatus.Active, "");
    }

    function endElection(uint256 electionID) external onlyOwner {
        Election storage election = elections[electionID];
        require(election.endTime <= block.timestamp, "too early");
        ElectionStatus oldStatus = election.status;

        election.status = ElectionStatus.Ended;
        emit ElectionStatusChanged(electionID, oldStatus, ElectionStatus.Ended, "");
    }

    function cancelElection(uint256 electionID, string memory cancelReasonIPFSHash) external onlyOwner {
        Election storage election = elections[electionID];
        ElectionStatus oldStatus = election.status;

        election.status = ElectionStatus.Canceled;
        election.cancelReasonIPFSHash = cancelReasonIPFSHash;
        emit ElectionStatusChanged(electionID, oldStatus, ElectionStatus.Canceled, cancelReasonIPFSHash);
    }

    function createElection(
        uint256 startTime,
        uint256 endTime,
        uint8 registerID,
        uint8 authProviderId,
        uint8 svsId,
        uint8 ballotLength,
        string memory descriptionIPFSHash,
        string memory ballotIPFSHash,
        bytes memory publicKey
    ) external onlyOwner returns(uint256 createdElectionID) {
        require(startTime < endTime, "Start time must be before end time.");
        require(startTime > block.timestamp, "Start time in past");

        require(registers[registerID].owner != address(0), "Invalid registerID");
        require(aps[authProviderId].owner != address(0), "Invalid authProviderId");
        require(svss[svsId].owner != address(0), "Invalid svsId");

        require(bytes(descriptionIPFSHash).length > 0, "Invalid description hash"); //todo: Specify expected Length
        require(bytes(ballotIPFSHash).length > 0, "Invalid ballot hash"); //todo: Specify expected Length

        require(publicKey.length > 0, "Invalid election PubKey"); //todo: Specify expected Length

        elections.push();
        uint256 electionID = elections.length - 1;

        Election storage election = elections[electionID];
        election.status = ElectionStatus.Pending;
        election.electionID = electionID;
        election.descriptionIPFSHash = descriptionIPFSHash;
        election.startTime = startTime;
        election.endTime = endTime;
        election.registerID = registerID;
        election.authProviderId = authProviderId;
        election.svsId = svsId;
        election.ballotIPFSHash = ballotIPFSHash;
        election.publicKey = publicKey;
        election.ballotLength = ballotLength;

        emit ElectionCreated(
            electionID,
            startTime,
            endTime,
            registerID,
            authProviderId,
            svsId,
            ballotLength,
            descriptionIPFSHash,
            ballotIPFSHash
        );
        return electionID; 
    }

    function publishElectionResults(
        uint256 electionID,
        uint256[] calldata yesVotes,
        uint256[] calldata noVotes,
        uint256[] calldata invalidVotes,
        bytes memory privateKey
    ) external onlyOwner {
        Election storage election = elections[electionID];

        require(election.status == ElectionStatus.Ended, "Election not ended");

        require(
            yesVotes.length == election.ballotLength && yesVotes.length == noVotes.length
                && noVotes.length == invalidVotes.length,
            "Results arrays must have the same length."
        );

        election.status = ElectionStatus.ResultsPublished;
        election.privateKey = privateKey;

        //todo uncomment if election results should be stored onchain
        
        // delete election.results;

        // for (uint256 i = 0; i < yesVotes.length; i++) {
        //     election.results.push(
        //         ElectionResult({yesVotes: yesVotes[i], noVotes: noVotes[i], invalidVotes: invalidVotes[i]})
        //     );
        // }

        emit ElectionResultsPublished(electionID, privateKey, yesVotes, noVotes, invalidVotes);
    }

    function _verify(bytes32 data, bytes memory signature, address account) internal pure returns (bool) {
        return data.toEthSignedMessageHash().recover(signature) == account;
    }
}
