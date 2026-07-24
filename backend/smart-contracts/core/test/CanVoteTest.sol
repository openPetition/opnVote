// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {OpnVote} from "../src/OpnVote.sol";
import {BLSVerifier} from "../src/BLSVerifier.sol";
import {AuthorizationProvider, Register} from "../src/Structs.sol";

contract CanVoteTest is Test {
    OpnVote opnVote;
    BLSVerifier blsVerifier;

    address electionCoordinator = vm.envAddress("DEPLOYER_ADDRESS");

    address apOwner = vm.envAddress("AP_OWNER_ADDRESS");
    uint8 apId = uint8(vm.envUint("AP_ID"));

    address registerOwner = vm.envAddress("REGISTER_OWNER_ADDRESS");
    uint8 registerId = uint8(vm.envUint("REGISTER_ID"));

    address voter = address(0xF1554f6997b304F2Bc694Ff0a8D966589C05C149);

    uint256 electionId;
    uint256 endTime;

    bytes voteEncrypted = new bytes(256);
    bytes voteEncryptedUser = hex"454a5cd040e6f04fce1cadd5196ed944792471d19bf538a4fa7705a00ae334aefc";
    bytes firstVoteSig = new bytes(128);
    bytes recastSig = hex"";

    function setUp() public {
        vm.startPrank(electionCoordinator);
        blsVerifier = new BLSVerifier();
        opnVote = new OpnVote(0, address(blsVerifier));

        opnVote.addAp(AuthorizationProvider(apId, apOwner, "OpenPetition AP", "https://www.openpetition.de/ap/"));
        opnVote.addRegister(Register(registerId, registerOwner, "OpenVote Register", "https://register.opn.vote"));

        uint256 startTime = block.timestamp + 1;
        endTime = block.timestamp + 100;
        electionId = opnVote.createOrUpdateElection(0, startTime, endTime, 0, 0, registerId, apId, "IPFS", hex"11");
        vm.stopPrank();

        bytes memory registerPubKey = new bytes(256);
        registerPubKey[0] = 0x01;
        vm.prank(registerOwner);
        opnVote.setElectionRegisterPublicKey(electionId, registerPubKey);

        vm.warp(block.timestamp + 1);
        vm.prank(electionCoordinator);
        opnVote.startElection(electionId);

        mockBls(true);
    }

    function mockBls(bool result) internal {
        vm.mockCall(address(blsVerifier), abi.encodeWithSelector(BLSVerifier.verify.selector), abi.encode(result));
    }

    function assertCanVoteMatchesVote(uint256 electionId_, bytes memory ve, bytes memory veu, bytes memory sig)
        internal
    {
        (bool ok, string memory reason,) = opnVote.canVote(electionId_, voter, ve, veu, sig);
        if (!ok) {
            vm.expectRevert(bytes(reason));
        }
        vm.prank(voter);
        opnVote.vote(electionId_, ve, veu, sig);
    }

    function castFirstVote() internal {
        vm.prank(voter);
        opnVote.vote(electionId, voteEncrypted, voteEncryptedUser, firstVoteSig);
    }

    function test_FirstVote_Ok() public {
        (bool ok, string memory reason, uint48 validUntil) =
            opnVote.canVote(electionId, voter, voteEncrypted, voteEncryptedUser, firstVoteSig);

        assertTrue(ok);
        assertEq(reason, "");
        assertEq(uint256(validUntil), endTime);

        assertCanVoteMatchesVote(electionId, voteEncrypted, voteEncryptedUser, firstVoteSig);
    }

    function test_UnknownElection() public {
        (bool ok, string memory reason,) =
            opnVote.canVote(999, voter, voteEncrypted, voteEncryptedUser, firstVoteSig);

        assertFalse(ok);
        assertEq(reason, "Election unknown");

        assertCanVoteMatchesVote(999, voteEncrypted, voteEncryptedUser, firstVoteSig);
    }

    function test_InvalidVoteEncryptedLength() public {
        bytes memory badPayload = new bytes(255);
        (bool ok, string memory reason,) =
            opnVote.canVote(electionId, voter, badPayload, voteEncryptedUser, firstVoteSig);

        assertFalse(ok);
        assertEq(reason, "Invalid voteEncrypted length");

        assertCanVoteMatchesVote(electionId, badPayload, voteEncryptedUser, firstVoteSig);
    }

    function test_InvalidVoteEncryptedUserLength() public {
        bytes memory empty = hex"";
        bytes memory tooLong = new bytes(513);

        (bool ok, string memory reason,) = opnVote.canVote(electionId, voter, voteEncrypted, empty, firstVoteSig);
        assertFalse(ok);
        assertEq(reason, "Invalid voteEncryptedUser length");

        (ok, reason,) = opnVote.canVote(electionId, voter, voteEncrypted, tooLong, firstVoteSig);
        assertFalse(ok);
        assertEq(reason, "Invalid voteEncryptedUser length");

        assertCanVoteMatchesVote(electionId, voteEncrypted, empty, firstVoteSig);
        assertCanVoteMatchesVote(electionId, voteEncrypted, tooLong, firstVoteSig);
    }

    function test_ElectionNotActive() public {
        vm.prank(electionCoordinator);
        uint256 pendingElectionId = opnVote.createOrUpdateElection(
            0, block.timestamp + 10, block.timestamp + 100, 0, 0, registerId, apId, "IPFS", hex"11"
        );

        (bool ok, string memory reason,) =
            opnVote.canVote(pendingElectionId, voter, voteEncrypted, voteEncryptedUser, firstVoteSig);

        assertFalse(ok);
        assertEq(reason, "Election is not active");

        assertCanVoteMatchesVote(pendingElectionId, voteEncrypted, voteEncryptedUser, firstVoteSig);
    }

    function test_AlreadyVoted() public {
        castFirstVote();

        (bool ok, string memory reason,) =
            opnVote.canVote(electionId, voter, voteEncrypted, voteEncryptedUser, firstVoteSig);

        assertFalse(ok);
        assertEq(reason, "Already voted");

        assertCanVoteMatchesVote(electionId, voteEncrypted, voteEncryptedUser, firstVoteSig);
    }

    function test_SigInvalid() public {
        mockBls(false);

        (bool ok, string memory reason,) =
            opnVote.canVote(electionId, voter, voteEncrypted, voteEncryptedUser, firstVoteSig);

        assertFalse(ok);
        assertEq(reason, "Sig invalid");

        assertCanVoteMatchesVote(electionId, voteEncrypted, voteEncryptedUser, firstVoteSig);
    }

    function test_RecastBeforeFirstVote() public {
        (bool ok, string memory reason,) =
            opnVote.canVote(electionId, voter, voteEncrypted, voteEncryptedUser, recastSig);

        assertFalse(ok);
        assertEq(reason, "voter unknown");

        assertCanVoteMatchesVote(electionId, voteEncrypted, voteEncryptedUser, recastSig);
    }

    function test_RecastAfterVote_Ok() public {
        castFirstVote();

        (bool ok, string memory reason, uint48 validUntil) =
            opnVote.canVote(electionId, voter, voteEncrypted, voteEncryptedUser, recastSig);

        assertTrue(ok);
        assertEq(reason, "");
        assertEq(uint256(validUntil), endTime);

        assertCanVoteMatchesVote(electionId, voteEncrypted, voteEncryptedUser, recastSig);
    }

    function test_IgnoresTime_ValidUntilExpiresInstead() public {
        vm.warp(endTime + 1);

        (bool ok,, uint48 validUntil) =
            opnVote.canVote(electionId, voter, voteEncrypted, voteEncryptedUser, firstVoteSig);

        assertTrue(ok);
        assertLt(validUntil, block.timestamp);

        vm.expectRevert(bytes("Election ended"));
        vm.prank(voter);
        opnVote.vote(electionId, voteEncrypted, voteEncryptedUser, firstVoteSig);
    }
}
