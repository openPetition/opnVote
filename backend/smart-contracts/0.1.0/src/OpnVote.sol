// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ERC2771Context, Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import {
    Election,
    AuthorizationProvider,
    Register,
    SignatureValidationServer,
    ElectionStatus,
    RsaPublicKeyRaw
} from "./Structs.sol";

contract OpnVote is Ownable, ERC2771Context {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    string public constant VERSION = "0.1.0";

    /// @return Current contract version
    function version() external pure returns (string memory) {
        return VERSION;
    }

    uint256 public nextElectionId;

    constructor(address _trustedForwarder, uint256 startId) Ownable(msg.sender) ERC2771Context(_trustedForwarder) {
        nextElectionId = startId;
    }

    mapping(uint8 => Register) public registers;
    mapping(uint8 => SignatureValidationServer) public svss;
    mapping(uint8 => AuthorizationProvider) public aps;
    mapping(uint256 => Election) public elections;

    /**
     * Events *
     */

    // AP Events
    event VoterAuthorized(uint8 indexed apId, uint256 indexed electionId, uint256 indexed voterId);

    event VotersAuthorized(uint8 indexed apId, uint256 indexed electionId, uint256[] voterIds);

    // Register Events
    event VoterRegistered(
        uint8 indexed registerId,
        uint256 indexed electionId,
        uint256 indexed voterId,
        bytes blindedSignature,
        bytes blindedElectionToken
    );

    event VotersRegistered(
        uint8 indexed registerId,
        uint256 indexed electionId,
        uint256[] voterIds,
        bytes[] blindedSignatures,
        bytes[] blindedElectionTokens
    );

    event ElectionRegisterPublicKeySet(uint256 indexed electionId, bytes n, bytes e);

    // Voter Events
    event VoteCast(
        uint256 indexed electionId,
        address indexed voter,
        bytes svsSignature,
        bytes voteEncrypted,
        bytes voteEncryptedUser,
        bytes unblindedElectionToken,
        bytes unblindedSignature
    );
    event VoteUpdated(uint256 indexed electionId, address indexed voter, bytes voteEncrypted, bytes voteEncryptedUser);

    // Admin Events
    event ElectionCreated(
        uint256 indexed electionId,
        uint256 votingStartTime,
        uint256 votingEndTime,
        uint256 registrationStartTime,
        uint256 registrationEndTime,
        uint8 registerId,
        uint8 authProviderId,
        uint8 svsId,
        string descriptionIpfsCid,
        bytes publicKey
    );

    event ElectionUpdated(
        uint256 indexed electionId,
        uint256 votingStartTime,
        uint256 votingEndTime,
        uint256 registrationStartTime,
        uint256 registrationEndTime,
        uint8 registerId,
        uint8 authProviderId,
        uint8 svsId,
        string descriptionIpfsCid,
        bytes publicKey
    );

    event ElectionStatusChanged(uint256 indexed electionId, ElectionStatus oldStatus, ElectionStatus newStatus);

    event ElectionCanceled(uint256 indexed electionId, string cancelReasonIpfsCid);

    event ElectionResultsPublished(
        uint256 indexed electionId, uint256[] yesVotes, uint256[] noVotes, uint256[] invalidVotes, bytes privateKey
    );

    /**
     * AP Methods  *
     */

    // voterId will not be stored or validated onchain as register & Ap might publish them in no specific order
    function authorizeVoter(uint256 electionId, uint256 voterId) external {
        uint8 apId = elections[electionId].authProviderId;
        require(msg.sender == aps[apId].owner, "Only AP Owner");
        require(elections[electionId].votingStartTime != 0, "Election unknown");
        elections[electionId].totalAuthorized += 1;
        emit VoterAuthorized(apId, electionId, voterId);
    }

    function authorizeVoters(uint256 electionId, uint256[] calldata voterIds) external {
        uint8 apId = elections[electionId].authProviderId;
        require(msg.sender == aps[apId].owner, "Only AP Owner");
        require(elections[electionId].votingStartTime != 0, "Election unknown");
        elections[electionId].totalAuthorized += voterIds.length;
        emit VotersAuthorized(apId, electionId, voterIds);
    }

    /**
     * Register Methods  *
     */
    function registerVoter(
        uint256 electionId,
        uint256 voterId,
        bytes calldata blindedSignature,
        bytes calldata blindedElectionToken
    ) external {
        uint8 registerId = elections[electionId].registerId;
        require(msg.sender == registers[registerId].owner, "Only Register Owner");
        require(blindedSignature.length > 0, "Blinded Signature required"); //todo: Specify expected Length
        require(blindedElectionToken.length > 0, "Blinded Signature required"); //todo: Specify expected Length
        require(elections[electionId].votingStartTime != 0, "Election unknown");
        elections[electionId].totalRegistered += 1;

        emit VoterRegistered(registerId, electionId, voterId, blindedSignature, blindedElectionToken);
    }

    function registerVoters(
        uint256 electionId,
        uint256[] calldata voterIds,
        bytes[] calldata blindedSignatures,
        bytes[] calldata blindedElectionTokens
    ) external {
        uint8 registerId = elections[electionId].registerId;
        require(msg.sender == registers[registerId].owner, "Only Register Owner");
        require(blindedSignatures.length > 0, "Blinded Signature required"); //todo: Specify expected Length
        require(blindedElectionTokens.length > 0, "Blinded Signature required"); //todo: Specify expected Length
        require(voterIds.length > 0, "voterIds required"); //todo: Specify expected Length
        require(elections[electionId].votingStartTime != 0, "Election unknown");

        elections[electionId].totalRegistered += voterIds.length;

        emit VotersRegistered(registerId, electionId, voterIds, blindedSignatures, blindedElectionTokens);
    }

    function setElectionRegisterPublicKey(uint256 electionId, bytes memory n, bytes memory e) external {
        uint8 registerId = elections[electionId].registerId;
        require(registers[registerId].owner == msg.sender, "Only Register");
        require(
            elections[electionId].status == ElectionStatus.Pending
                || elections[electionId].status == ElectionStatus.Active,
            "Election not active or pending"
        );
        elections[electionId].registerPubKey = RsaPublicKeyRaw({n: n, e: e});

        emit ElectionRegisterPublicKeySet(electionId, n, e);
    }

    /**
     * Voter Methods  *
     */
    function vote(
        uint256 electionId,
        address voter,
        bytes calldata svsSignature,
        bytes calldata voteEncrypted,
        bytes calldata voteEncryptedUser,
        bytes calldata unblindedElectionToken,
        bytes calldata unblindedSignature
    ) external {
        Election storage election = elections[electionId];
        require(election.votingStartTime != 0, "Election unknown");

        require(voteEncrypted.length == 256 || voteEncrypted.length == 512, "Invalid voteEncrypted length"); // Allowing RSA 2048 and 4096
        require(voteEncryptedUser.length > 0 && voteEncryptedUser.length <= 512, "Invalid voteEncryptedUser length"); // Allowing symmetric enc and up to RSA 4096

        require(election.status == ElectionStatus.Active, "Election is not active");
        require(election.votingEndTime >= block.timestamp, "Election ended");

        if (svsSignature.length == 65) {
            address svsOwner = svss[election.svsId].owner;
            require(svsOwner != address(0), "SVS not specified");
            require(unblindedElectionToken.length == 32, "Invalid unblindedElectionToken length");
            require(
                unblindedSignature.length == 256 || unblindedSignature.length == 512,
                "Invalid unblindedSignature length"
            ); // Allowing RSA 2048 and 4096

            require(!election.hasVoted[voter], "Already voted");

            bool isValidSig = _verify(
                keccak256(
                    abi.encode(
                        electionId, voter, voteEncrypted, voteEncryptedUser, unblindedElectionToken, unblindedSignature
                    )
                ),
                svsSignature,
                svsOwner
            );

            require(isValidSig, "Sig invalid");
            election.totalVotes += 1;
            election.hasVoted[voter] = true;

            //First vote
            emit VoteCast(
                electionId,
                voter,
                svsSignature,
                voteEncrypted,
                voteEncryptedUser,
                unblindedElectionToken,
                unblindedSignature
            );
        } else {
            //Vote recasting
            require(election.hasVoted[_msgSender()], "voter unknown");
            emit VoteUpdated(electionId, _msgSender(), voteEncrypted, voteEncryptedUser);
        }
    }

    /**
     * Admin Methods  *
     */
    function addRegister(Register memory newRegister) external onlyOwner {
        require(registers[newRegister.id].owner == address(0), "Id already used");
        require(newRegister.owner != address(0), "No owner specified");
        registers[newRegister.id] = newRegister;
    }

    function addSvs(SignatureValidationServer memory newSvs) external onlyOwner {
        require(svss[newSvs.id].owner == address(0), "Id already used");
        require(newSvs.owner != address(0), "No owner specified");
        svss[newSvs.id] = newSvs;
    }

    function addAp(AuthorizationProvider memory newAp) external onlyOwner {
        require(aps[newAp.id].owner == address(0), "Id already used");
        require(newAp.owner != address(0), "No owner specified");
        aps[newAp.id] = newAp;
    }

    /**
     * Admin Election Methods  *
     */
    function startElection(uint256 electionId) external onlyOwner {
        Election storage election = elections[electionId];
        require(election.votingStartTime != 0, "Election unknown");
        require(election.status == ElectionStatus.Pending, "Not pending");
        require(election.votingStartTime <= block.timestamp, "too early");
        require(election.votingEndTime > block.timestamp, "too late");
        require(election.registerPubKey.n.length > 0 && election.registerPubKey.e.length > 0, "Register Key required"); //todo: Specify expected Length
        ElectionStatus oldStatus = election.status;
        election.status = ElectionStatus.Active;
        emit ElectionStatusChanged(electionId, oldStatus, ElectionStatus.Active);
    }

    function endElection(uint256 electionId) external onlyOwner {
        Election storage election = elections[electionId];
        require(election.votingStartTime != 0, "Election unknown");
        require(election.votingEndTime <= block.timestamp, "too early");
        require(
            election.status == ElectionStatus.Active || election.status == ElectionStatus.Pending,
            "Not active or pending"
        );
        ElectionStatus oldStatus = election.status;

        election.status = ElectionStatus.Ended;
        emit ElectionStatusChanged(electionId, oldStatus, ElectionStatus.Ended);
    }

    function cancelElection(uint256 electionId, string memory cancelReasonIpfsCid) external onlyOwner {
        Election storage election = elections[electionId];
        require(election.votingStartTime != 0, "Election unknown");
        ElectionStatus oldStatus = election.status;

        election.status = ElectionStatus.Canceled;
        election.cancelReasonIpfsCid = cancelReasonIpfsCid;
        emit ElectionCanceled(electionId, cancelReasonIpfsCid);
        emit ElectionStatusChanged(electionId, oldStatus, ElectionStatus.Canceled);
    }

    function createOrUpdateElection(
        uint256 manualElectionId,
        uint256 votingStartTime,
        uint256 votingEndTime,
        uint256 registrationStartTime,
        uint256 registrationEndTime,
        uint8 registerId,
        uint8 authProviderId,
        uint8 svsId,
        string memory descriptionIpfsCid,
        bytes memory publicKey
    ) external onlyOwner returns (uint256 electionId) {
        require(votingStartTime < votingEndTime, "Start time must be before end time.");
        require(votingStartTime > block.timestamp, "Start time in past");

        require(registers[registerId].owner != address(0), "Invalid registerId");
        require(aps[authProviderId].owner != address(0), "Invalid authProviderId");
        require(svss[svsId].owner != address(0), "Invalid svsId");

        require(bytes(descriptionIpfsCid).length > 0, "Invalid description cid"); //todo: Specify expected Length

        require(publicKey.length > 0, "Invalid election PubKey"); //todo: Specify expected Length
        electionId = manualElectionId == 0 ? nextElectionId++ : manualElectionId;
        if (manualElectionId != 0 && manualElectionId >= nextElectionId) {
            nextElectionId = manualElectionId + 1;
        }

        Election storage election = elections[electionId];
        bool isNewElection = election.votingStartTime == 0;

        require(isNewElection || election.status == ElectionStatus.Pending, "Already started");
        election.status = ElectionStatus.Pending;
        election.electionId = electionId;
        election.descriptionIpfsCid = descriptionIpfsCid;
        election.votingStartTime = votingStartTime;
        election.votingEndTime = votingEndTime;
        election.registerId = registerId;
        election.authProviderId = authProviderId;
        election.svsId = svsId;
        election.publicKey = publicKey;

        if (isNewElection) {
            emit ElectionCreated(
                electionId,
                votingStartTime,
                votingEndTime,
                registrationStartTime,
                registrationEndTime,
                registerId,
                authProviderId,
                svsId,
                descriptionIpfsCid,
                publicKey
            );
        } else {
            emit ElectionUpdated(
                electionId,
                votingStartTime,
                votingEndTime,
                registrationStartTime,
                registrationEndTime,
                registerId,
                authProviderId,
                svsId,
                descriptionIpfsCid,
                publicKey
            );
        }
        return electionId;
    }

    function publishElectionResults(
        uint256 electionId,
        uint256[] calldata yesVotes,
        uint256[] calldata noVotes,
        uint256[] calldata invalidVotes,
        bytes memory privateKey
    ) external onlyOwner {
        Election storage election = elections[electionId];
        require(election.votingStartTime != 0, "Election unknown");
        require(election.status == ElectionStatus.Ended, "Election not ended");
        require(
            yesVotes.length > 0 && yesVotes.length == noVotes.length && yesVotes.length == invalidVotes.length,
            "Array length mismatch"
        );

        election.status = ElectionStatus.ResultsPublished;
        election.privateKey = privateKey;

        emit ElectionResultsPublished(electionId, yesVotes, noVotes, invalidVotes, privateKey);
        emit ElectionStatusChanged(electionId, ElectionStatus.Ended, ElectionStatus.ResultsPublished);
    }

    function _verify(bytes32 data, bytes memory signature, address account) internal pure returns (bool) {
        return data.toEthSignedMessageHash().recover(signature) == account;
    }

    /**
     * OZ Overrides  *
     */
    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength() internal pure override(Context, ERC2771Context) returns (uint256) {
        return 20;
    }
}
