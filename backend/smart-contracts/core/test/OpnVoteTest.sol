// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {OpnVote} from "../src/OpnVote.sol";
import {BLSVerifier} from "../src/BLSVerifier.sol";
import {AuthorizationProvider, Register} from "../src/Structs.sol";

contract OpnVoteTest is Test {
    OpnVote opnVote;
    BLSVerifier blsVerifier;

    address electionCoordinator = vm.envAddress("DEPLOYER_ADDRESS");

    address apOwner = vm.envAddress("AP_OWNER_ADDRESS");
    uint8 apId = uint8(vm.envUint("AP_ID"));

    address registerOwner = vm.envAddress("REGISTER_OWNER_ADDRESS");
    uint8 registerId = uint8(vm.envUint("REGISTER_ID"));

    function setUp() public {
        vm.startPrank(electionCoordinator);
        blsVerifier = new BLSVerifier();
        opnVote = new OpnVote(0, address(blsVerifier));

        AuthorizationProvider memory ap =
            AuthorizationProvider(apId, apOwner, "OpenPetition AP", "https://www.openpetition.de/ap/");
        Register memory register = Register(registerId, registerOwner, "OpenVote Register", "https://register.opn.vote");

        opnVote.addAp(ap);
        opnVote.addRegister(register);
        vm.stopPrank();
    }

    function test_CreateElectionAndVote() public {
        vm.startPrank(electionCoordinator);
        // Creating Election
        uint256 startTime = block.timestamp + 1;
        uint256 endTime = block.timestamp + 100;

        string memory descriptionIpfsCid = "IPFS"; //todo Set IPFS data
        bytes memory electionPubKey = hex"11"; //todo Set Election Pub Key

        uint256 electionId = opnVote.createOrUpdateElection(
            0, startTime, endTime, 0, 0, registerId, apId, descriptionIpfsCid, electionPubKey
        );

        vm.stopPrank();

        //Setting Regiser Key
        vm.startPrank(registerOwner);

        bytes memory registerElectionPubKeyE = vm.envBytes("REGISTER_ELECTION_0_E");
        bytes memory registerElectionPubKeyN = vm.envBytes("REGISTER_ELECTION_0_N");

        opnVote.setElectionRegisterPublicKey(electionId, registerElectionPubKeyN, registerElectionPubKeyE);
        vm.stopPrank();

        //Starting created Election
        vm.startPrank(electionCoordinator);
        vm.warp(block.timestamp + 1);

        opnVote.startElection(0);
        vm.stopPrank();

        //Voting (Dummy Data with correct format & mocked BLS verify)
        address voter = address(0xF1554f6997b304F2Bc694Ff0a8D966589C05C149);

        // 128-byte placeholder
        bytes memory unblindedSignature = new bytes(128);

        //Dummy RSA encrypted vote
        bytes memory voteEncrypted =
            hex"716184755039beb809d8aaff3fad62560412dff2bb47b01a915065342bf05c1e78b22cf3902debfbb0ae77364d4fd297e9249aaecccd3c381e9cc2b6c4532fff13eaa51c5567f177520136526c37fdce62b1392b7a7af46cde76a98d5b4652ad5da82d1c7b70d2ad1c01ff28e7558907774da1e6af9961b0d3cb07ee87ec0a1290a7036e55889b34f8990a12606c5ec3ce057409b4358fdc23800dbfc49c0d4cc6fb4e6e538fb0a393e1bd192e830bacdb1a6fea0d9948d29755968e09efa41b56647cf75e18cb62dfb24ae7aae2baa5f22d5cdb2c3a3d7a140cb0b56e1febbd27f861e9cfcb51cf3758e3b41e136f1e6ff98b46f179275f2b460f624e5c2ad6"; // Dummy Data

        bytes memory voteEncryptedUser = hex"454a5cd040e6f04fce1cadd5196ed944792471d19bf538a4fa7705a00ae334aefc"; // Dummy Data

        vm.mockCall(
            address(blsVerifier),
            abi.encodeWithSelector(BLSVerifier.verify.selector),
            abi.encode(true)
        );

        vm.startPrank(voter);
        opnVote.vote(electionId, voteEncrypted, voteEncryptedUser, unblindedSignature);
        vm.stopPrank();
    }
}
