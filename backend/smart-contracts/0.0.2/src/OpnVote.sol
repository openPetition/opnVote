// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "./Structs.sol";

contract OpnVote is Ownable, ERC2771Context {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    constructor(address _trustedForwarder) Ownable(msg.sender) ERC2771Context(_trustedForwarder) {}
    mapping(uint8 => Register) public registers;
    mapping(uint8 => SignatureValidationServer) public svss;
    mapping(uint8 => AuthorizationProvider) public aps;
    Election[] public elections;

    /** Events **/

    // AP Events
    event VoterAuthorized(
        uint8 indexed apID,
        uint256 indexed electionID,
        uint256 indexed voterID
    );

    event VotersAuthorized(
        uint8 indexed apID,
        uint256 indexed electionID,
        uint256[] voterIDs
    );

    // Register Events
    event VoterRegistered(
        uint8 indexed registerID,
        uint256 indexed electionID,
        uint256 indexed voterID,
        bytes blindedSignature,
        bytes blindedElectionToken
    );

    event VotersRegistered(
        uint8 indexed registerID,
        uint256 indexed electionID,
        uint256[] voterIDs,
        bytes[] blindedSignatures,
        bytes[] blindedElectionTokens
    );

    event ElectionRegisterPublicKeySet(
        uint256 indexed electionID,
        bytes n,
        bytes e
    );

    // Voter Events
    event VoteCast(
        uint256 indexed electionID,
        address indexed voter,
        bytes svsSignature,
        bytes vote_encrypted,
        bytes vote_encrypted_user,
        bytes unblindedElectionToken,
        bytes unblindedSignature
    );
    event VoteUpdated(
        uint256 indexed electionID,
        address indexed voter,
        bytes vote_encrypted,
        bytes vote_encrypted_user
    );

    // Admin Events
    event ElectionCreated(
        uint256 indexed electionID,
        uint256 startTime,
        uint256 endTime,
        uint8 registerId,
        uint8 authProviderId,
        uint8 svsId,
        string descriptionIPFSCID,
        bytes publicKey
    );

    event ElectionStatusChanged(
        uint256 indexed electionID,
        ElectionStatus oldStatus,
        ElectionStatus newStatus
    );

    event ElectionCanceled(
        uint256 indexed electionID,
        string cancelReasonIPFSCID
    );

    event ElectionResultsPublished(
        uint256 indexed electionID,
        bytes privateKey,
        uint256 yesVotes,
        uint256 noVotes,
        uint256 invalidVotes
    );

    /** AP Methods  **/

    // voterID will not be stored or validated onchain as register & Ap might publish them in no specific order
    function authorizeVoter(uint256 electionID, uint256 voterID) external {
        uint8 apID = elections[electionID].authProviderId;
        require(msg.sender == aps[apID].owner, "Only AP Owner");
        elections[electionID].totalAuthorized += 1;
        emit VoterAuthorized(apID, electionID, voterID);
    }

    function authorizeVoters(
        uint256 electionID,
        uint256[] calldata voterIDs
    ) external {
        uint8 apID = elections[electionID].authProviderId;
        require(msg.sender == aps[apID].owner, "Only AP Owner");
        elections[electionID].totalAuthorized += voterIDs.length;
        emit VotersAuthorized(apID, electionID, voterIDs);
    }

    /** Register Methods  **/
    function registerVoter(
        uint256 electionID,
        uint256 voterID,
        bytes calldata blindedSignature,
        bytes calldata blindedElectionToken
    ) external {
        uint8 registerID = elections[electionID].registerID;
        require(
            msg.sender == registers[registerID].owner,
            "Only Register Owner"
        );
        require(blindedSignature.length > 0, "Blinded Signature required"); //todo: Specify expected Length
        require(blindedElectionToken.length > 0, "Blinded Signature required"); //todo: Specify expected Length
        elections[electionID].totalRegistered += 1;

        emit VoterRegistered(
            registerID,
            electionID,
            voterID,
            blindedSignature,
            blindedElectionToken
        );
    }

    function registerVoters(
        uint256 electionID,
        uint256[] calldata voterIDs,
        bytes[] calldata blindedSignatures,
        bytes[] calldata blindedElectionTokens
    ) external {
        uint8 registerID = elections[electionID].registerID;
        require(
            msg.sender == registers[registerID].owner,
            "Only Register Owner"
        );
        require(blindedSignatures.length > 0, "Blinded Signature required"); //todo: Specify expected Length
        require(blindedElectionTokens.length > 0, "Blinded Signature required"); //todo: Specify expected Length
        require(voterIDs.length > 0, "voterIDs required"); //todo: Specify expected Length

        elections[electionID].totalRegistered += voterIDs.length;

        emit VotersRegistered(
            registerID,
            electionID,
            voterIDs,
            blindedSignatures,
            blindedElectionTokens
        );
    }

    function setElectionRegisterPublicKey(
        uint256 electionID,
        bytes memory n,
        bytes memory e
    ) external {
        uint8 registerID = elections[electionID].registerID;
        require(registers[registerID].owner == msg.sender, "Only Register");
        require(
            elections[electionID].status == ElectionStatus.Pending ||
                elections[electionID].status == ElectionStatus.Active,
            "Election not active or pending"
        );
        elections[electionID].registerPubKey = RSAPublicKeyRaw({n: n, e: e});

        emit ElectionRegisterPublicKeySet(electionID, n, e);
    }

    /** Voter Methods  **/
    function vote(
        uint256 electionID,
        address voter,
        bytes calldata svsSignature,
        bytes calldata vote_encrypted,
        bytes calldata vote_encrypted_user,
        bytes calldata unblindedElectionToken,
        bytes calldata unblindedSignature
    ) external {
        Election storage election = elections[electionID];

        require(vote_encrypted.length == 256 || vote_encrypted.length == 512, "Invalid vote_encrypted length"); // Allowing RSA 2048 and 4096
        require(vote_encrypted_user.length > 0 && vote_encrypted_user.length <= 512, "Invalid vote_encrypted_user length"); // Allowing symmetric enc and up to RSA 4096

        require(election.status == ElectionStatus.Active, "Election is not active");
        require(election.endTime >= block.timestamp, "Election ended");

        if (svsSignature.length == 65) {
            address svsOwner = svss[election.svsId].owner;
            require(svsOwner != address(0), "SVS not specified");
            require(unblindedElectionToken.length == 32, "Invalid unblindedElectionToken length");
            require(unblindedSignature.length == 256 || unblindedSignature.length == 512, "Invalid unblindedSignature length"); // Allowing RSA 2048 and 4096

            require(!election.hasVoted[voter], "Already voted");

            bool isValidSig = _verify(
                keccak256(
                    abi.encodePacked(
                        electionID,
                        voter,
                        vote_encrypted,
                        vote_encrypted_user,
                        unblindedElectionToken,
                        unblindedSignature
                    ) //todo: knwon hash collision; not exploitable
                ),
                svsSignature,
                svsOwner
            );

            require(isValidSig, "Sig invalid");
            election.totalVotes += 1;
            election.hasVoted[voter] = true;

            //First vote
            emit VoteCast(
                electionID,
                voter,
                svsSignature,
                vote_encrypted,
                vote_encrypted_user,
                unblindedElectionToken,
                unblindedSignature
            );
        } else {
            //Vote recasting
            require(election.hasVoted[_msgSender()], "voter unknown");
            emit VoteUpdated(
                electionID,
                _msgSender(),
                vote_encrypted,
                vote_encrypted_user
            );
        }
    }

    /** Admin Methods  **/

    function addRegister(Register memory newRegister) external onlyOwner {
        require(
            registers[newRegister.id].owner == address(0),
            "ID already used"
        );
        require(newRegister.owner != address(0), "No owner specified");
        registers[newRegister.id] = newRegister;
    }

    function addSVS(
        SignatureValidationServer memory newSVS
    ) external onlyOwner {
        require(svss[newSVS.id].owner == address(0), "ID already used");
        require(newSVS.owner != address(0), "No owner specified");
        svss[newSVS.id] = newSVS;
    }

    function addAP(AuthorizationProvider memory newAP) external onlyOwner {
        require(aps[newAP.id].owner == address(0), "ID already used");
        require(newAP.owner != address(0), "No owner specified");
        aps[newAP.id] = newAP;
    }

    /** Admin Election Methods  **/

    function startElection(uint256 electionID) external onlyOwner {
        Election storage election = elections[electionID];
        require(election.startTime <= block.timestamp, "too early");
        require(election.endTime > block.timestamp, "too late");
        require(
            election.registerPubKey.n.length > 0 &&
                election.registerPubKey.e.length > 0,
            "Register Key required"
        ); //todo: Specify expected Length
        ElectionStatus oldStatus = election.status;
        election.status = ElectionStatus.Active;
        emit ElectionStatusChanged(
            electionID,
            oldStatus,
            ElectionStatus.Active
        );
    }

    function endElection(uint256 electionID) external onlyOwner {
        Election storage election = elections[electionID];
        require(election.endTime <= block.timestamp, "too early");
        ElectionStatus oldStatus = election.status;

        election.status = ElectionStatus.Ended;
        emit ElectionStatusChanged(electionID, oldStatus, ElectionStatus.Ended);
    }

    function cancelElection(
        uint256 electionID,
        string memory cancelReasonIPFSCID
    ) external onlyOwner {
        Election storage election = elections[electionID];
        ElectionStatus oldStatus = election.status;

        election.status = ElectionStatus.Canceled;
        election.cancelReasonIPFSCID = cancelReasonIPFSCID;
        emit ElectionCanceled(electionID, cancelReasonIPFSCID);
        emit ElectionStatusChanged(
            electionID,
            oldStatus,
            ElectionStatus.Canceled
        );
    }

    function createElection(
        uint256 startTime,
        uint256 endTime,
        uint8 registerID,
        uint8 authProviderId,
        uint8 svsId,
        string memory descriptionIPFSCID,
        bytes memory publicKey
    ) external onlyOwner returns (uint256 createdElectionID) {
        require(startTime < endTime, "Start time must be before end time.");
        require(startTime > block.timestamp, "Start time in past");

        require(registers[registerID].owner != address(0),"Invalid registerID");
        require(aps[authProviderId].owner != address(0),"Invalid authProviderId");
        require(svss[svsId].owner != address(0), "Invalid svsId");

        require(bytes(descriptionIPFSCID).length > 0, "Invalid description CID"); //todo: Specify expected Length

        require(publicKey.length > 0, "Invalid election PubKey"); //todo: Specify expected Length

        elections.push();
        uint256 electionID = elections.length - 1;

        Election storage election = elections[electionID];
        election.status = ElectionStatus.Pending;
        election.electionID = electionID;
        election.descriptionIPFSCID = descriptionIPFSCID;
        election.startTime = startTime;
        election.endTime = endTime;
        election.registerID = registerID;
        election.authProviderId = authProviderId;
        election.svsId = svsId;
        election.publicKey = publicKey;

        emit ElectionCreated(
            electionID,
            startTime,
            endTime,
            registerID,
            authProviderId,
            svsId,
            descriptionIPFSCID,
            publicKey
        );
        return electionID;
    }

    function publishElectionResults(
        uint256 electionID,
        uint256 yesVotes,
        uint256 noVotes,
        uint256 invalidVotes,
        bytes memory privateKey
    ) external onlyOwner {
        Election storage election = elections[electionID];

        require(election.status == ElectionStatus.Ended, "Election not ended");

        election.status = ElectionStatus.ResultsPublished;
        election.privateKey = privateKey;

        emit ElectionResultsPublished(
            electionID,
            privateKey,
            yesVotes,
            noVotes,
            invalidVotes
        );
        emit ElectionStatusChanged(
            electionID,
            ElectionStatus.Ended,
            ElectionStatus.ResultsPublished
        );
    }

    function _verify(
        bytes32 data,
        bytes memory signature,
        address account
    ) internal pure returns (bool) {
        return data.toEthSignedMessageHash().recover(signature) == account;
    }

    /** OZ Overrides  **/

    function _msgSender()
        internal
        view
        override(Context, ERC2771Context)
        returns (address)
    {
        return ERC2771Context._msgSender();
    }

    function _msgData()
        internal
        view
        override(Context, ERC2771Context)
        returns (bytes calldata)
    {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength()
        internal
        pure
        override(Context, ERC2771Context)
        returns (uint256)
    {
        return 20;
    }
}
