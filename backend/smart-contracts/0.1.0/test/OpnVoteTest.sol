// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {OpnVote} from "../src/OpnVote.sol";
import {AuthorizationProvider, Register, SignatureValidationServer} from "../src/Structs.sol";

contract OpnVoteTest is Test {
    OpnVote opnVote;

    address electionCoordinator = vm.envAddress("DEPLOYER_ADDRESS");

    address apOwner = vm.envAddress("AP_OWNER_ADDRESS");
    uint8 apId = uint8(vm.envUint("AP_ID"));

    address registerOwner = vm.envAddress("REGISTER_OWNER_ADDRESS");
    uint8 registerId = uint8(vm.envUint("REGISTER_ID"));

    address svsOwner = vm.envAddress("SVS_OWNER_ADDRESS");
    uint8 svsId = uint8(vm.envUint("SVS_ID"));

    address gelatoTrustedForwarder = vm.envAddress("GELATO_TRUSTED_FORWARDER");

    function setUp() public {
        vm.startPrank(electionCoordinator);
        opnVote = new OpnVote(gelatoTrustedForwarder, 0);

        AuthorizationProvider memory ap =
            AuthorizationProvider(apId, apOwner, "OpenPetition AP", "https://www.openpetition.de/ap/");
        Register memory register = Register(registerId, registerOwner, "OpenVote Register", "https://register.opn.vote");
        SignatureValidationServer memory svs =
            SignatureValidationServer(svsId, svsOwner, "OpenVote SVS", "https://svs.opn.vote");

        opnVote.addAp(ap);
        opnVote.addRegister(register);
        opnVote.addSvs(svs);
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
            0, startTime, endTime, 0, 0, registerId, apId, svsId, descriptionIpfsCid, electionPubKey
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

        //Voting (Dummy Data with correct format & signature)

        //Signed Dummy Data; Signed by 0x847507B935658Bdf58F166E0B54C662Bc3942a6f
        //In case of invalid Sig, check if svsOwner is 0x847507B935658Bdf58F166E0B54C662Bc3942a6f
        address voter = address(0xF1554f6997b304F2Bc694Ff0a8D966589C05C149);
        address voteSignedBy = address(0x847507B935658Bdf58F166E0B54C662Bc3942a6f);
        uint256 voteElectionId = 0;
        require(svsOwner == voteSignedBy, "Sig will be invalid. SVS and vote signee different");
        require(electionId == voteElectionId, "Sig will be invalid. Election ID not signed Election ID different");

        bytes memory svsSignature =
            hex"72560ad0565a950e02a6ffdd8db109c347b6fd3020729c84c00e9993ef12c9b16294116839509826a5b44d579b3dff05d9eca80a06e893048208976afc5557f81c"; //Valid Signature

        bytes memory unblindedElectionToken = hex"0d8a836ae6c5f460900357b825d3133ab989e52c623a98022a94e31fd53e8d89"; // Dummy data
        bytes memory unblindedSignature =
            hex"11111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111"; // Dummy data

        //Dummy RSA encrypted vote
        bytes memory voteEncrypted =
            hex"716184755039beb809d8aaff3fad62560412dff2bb47b01a915065342bf05c1e78b22cf3902debfbb0ae77364d4fd297e9249aaecccd3c381e9cc2b6c4532fff13eaa51c5567f177520136526c37fdce62b1392b7a7af46cde76a98d5b4652ad5da82d1c7b70d2ad1c01ff28e7558907774da1e6af9961b0d3cb07ee87ec0a1290a7036e55889b34f8990a12606c5ec3ce057409b4358fdc23800dbfc49c0d4cc6fb4e6e538fb0a393e1bd192e830bacdb1a6fea0d9948d29755968e09efa41b56647cf75e18cb62dfb24ae7aae2baa5f22d5cdb2c3a3d7a140cb0b56e1febbd27f861e9cfcb51cf3758e3b41e136f1e6ff98b46f179275f2b460f624e5c2ad6"; // Dummy Data

        bytes memory voteEncryptedUser = hex"454a5cd040e6f04fce1cadd5196ed944792471d19bf538a4fa7705a00ae334aefc"; // Dummy Data

        vm.startPrank(voter);
        opnVote.vote(
            electionId,
            voter,
            svsSignature,
            voteEncrypted,
            voteEncryptedUser,
            unblindedElectionToken,
            unblindedSignature
        );
        vm.stopPrank();
    }
}
