// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {OpnVote} from "../src/OpnVote.sol";
import "../src/Structs.sol";

/*
  electionID: 6,
  voterAddress: '0x06da6654A39aA2238839E948D8A212F13E8Af95D',

  unblindedElectionToken: {
    hexString: '',
    isMaster: false,
    isBlinded: false
  },
  unblindedSignature: {
    hexString: '',
    isBlinded: false
  },
  svsSignature: {
    hexString: '0xbfa4829d42c453ae15eb1183679158a2879c31ec44aea04536213535b5f890351593f827f09b9e7f63890f49e2d9b6eff1f0847b1e7b2e93280b7042979e608e1c'
  }
*/

contract OpnVoteTest is Test {
    OpnVote opnVote;

    address electionCoordinator = vm.envAddress("DEPLOYER_ADDRESS");

    address apOwner = vm.envAddress("AP_OWNER_ADDRESS");
    uint8 apID = uint8(vm.envUint("AP_ID"));

    address registerOwner = vm.envAddress("REGISTER_OWNER_ADDRESS");
    uint8 registerID = uint8(vm.envUint("REGISTER_ID"));

    address svsOwner = vm.envAddress("SVS_OWNER_ADDRESS");
    uint8 svsID = uint8(vm.envUint("SVS_ID"));

    address gelatoTrustedForwarder = vm.envAddress("GELATO_TRUSTED_FORWARDER");

    function setUp() public {
        vm.startPrank(electionCoordinator);
        opnVote = new OpnVote(gelatoTrustedForwarder);

        AuthorizationProvider memory ap =
            AuthorizationProvider(apID, apOwner, "OpenPetition AP", "https://www.openpetition.de/ap/");
        Register memory register = Register(registerID, registerOwner, "OpenVote Register", "https://register.opn.vote");
        SignatureValidationServer memory svs =
            SignatureValidationServer(svsID, svsOwner, "OpenVote SVS", "https://svs.opn.vote");

        opnVote.addAP(ap);
        opnVote.addRegister(register);
        opnVote.addSVS(svs);
        vm.stopPrank();
    }

    function test_CreateElectionAndVote() public {
        vm.startPrank(electionCoordinator);
        // Creating Election
        uint256 startTime = block.timestamp + 1;
        uint256 endTime = block.timestamp + 100;

        string memory descriptionIPFSCID = "IPFS"; //todo Set IPFS data
        bytes memory electionPubKey = hex"11"; //todo Set Election Pub Key

        uint256 electionID = opnVote.createElection(
            startTime,
            endTime,
            registerID,
            apID,
            svsID,
            descriptionIPFSCID,
            electionPubKey
        );

        vm.stopPrank();

        //Setting Regiser Key
        vm.startPrank(registerOwner);

        bytes memory registerElectionPubKeyE = vm.envBytes("REGISTER_ELECTION_0_E");
        bytes memory registerElectionPubKeyN = vm.envBytes("REGISTER_ELECTION_0_N");

        opnVote.setElectionRegisterPublicKey(electionID, registerElectionPubKeyN, registerElectionPubKeyE);
        vm.stopPrank();

        //Starting created Election
        vm.startPrank(electionCoordinator);
        vm.warp(block.timestamp + 1);

        opnVote.startElection(0);
        vm.stopPrank();

        //Voting (Dummy Data with correct format & signature)

        //Signed Dummy Data; Signed by 0x847507B935658Bdf58F166E0B54C662Bc3942a6f
        //In case of invalid Sig, check if svsOwner is 0x847507B935658Bdf58F166E0B54C662Bc3942a6f
        address voter = address(0x06da6654A39aA2238839E948D8A212F13E8Af95D);
        address voteSignedBy = address(0x847507B935658Bdf58F166E0B54C662Bc3942a6f);
        uint256 voteElectionID = 0;
        require(svsOwner == voteSignedBy, "Sig will be invalid. SVS and vote signee different");
        require(electionID == voteElectionID, "Sig will be invalid. Election ID not signed Election ID different");

        bytes memory svsSignature =
            hex"bfa4829d42c453ae15eb1183679158a2879c31ec44aea04536213535b5f890351593f827f09b9e7f63890f49e2d9b6eff1f0847b1e7b2e93280b7042979e608e1c"; //Valid Signature

        bytes memory unblindedElectionToken = hex"0ba98fe80045b930072535d19a1dcc74c8ec90df16032d16cbc659f8803a2962"; // Dummy data
        bytes memory unblindedSignature =
            hex"03dce5ac44f7911ae2219a2d006c073e6a7ffc03acada25167acad9aab2800d7909eb5fa7aaef50c2809619f252879dcdcb79583d679b2324a820702eeec81cbb634b015e34e27f3b4961e8819275bfb1fd0bd7ca34ae82a6e4c542ee36dcffad15e18e153de29fe0aa8d82ef276b544c7d58606560cf6f0ffe5a55e4be4d8f2f23c41b058cdb290b2ec43b17e2a5f6d2cab13869699e504e8752d69c7290dfd787c8383b70316cac1671d4eaa997480d10ecc444add9fe254975cea26fe274c9fee7aa8c8abbda771d678774d116b036e50728a4c50250443070a1fd87f9095bcd2b3fac4c271a4346dea6e7d84686bf398c1d7185005fa7740dec3038809a6"; // Dummy data
        
        //Dummy RSA encrypted vote
        bytes memory vote_encrypted =
            hex"b4497c197a679af06d4e20be7d0049fdd48bd6f19a02f9ebb0b944f9e4a1fa71e151e486f0f267d68e33f1b9b54929d2c15f118fe650d8a8cc014e248c1a0ac82ebdbb0f5f884139e50a89c5eb3e699e7cf970261ea57a5d1f8d1057e6b3f30b6ba5f1c1dfdf2e47ed3949436350460bc49410032083a43b5c427a8bb9447522dc27d973c664c51b90c05fddeea88fb365f3b792ebaa049d9ce97c4fec7e27bfe8681f9b6ef5154472a1c65e8f990040aae7fefec096f18f55cdefe340e816bf9bff37fec89ee64277f8d8a36327ca257638dfd923f2f20760bb3c81c08b4e0c6b9310cea0037c45018210e8c4061dddc6d357583dacafe5b8a173af39e4ac99"; // Dummy Data
        
        bytes memory vote_encrypted_user =
            hex"b4497c197a679af06d4e20be7d0049fdd48bd6f19a02f9ebb0b944f9e4a1fa71e151e486f0f267d68e33f1b9b54929d2c15f118fe650d8a8cc014e248c1a0ac82ebdbb0f5f884139e50a89c5eb3e699e7cf970261ea57a5d1f8d1057e6b3f30b6ba5f1c1dfdf2e47ed3949436350460bc49410032083a43b5c427a8bb9447522dc27d973c664c51b90c05fddeea88fb365f3b792ebaa049d9ce97c4fec7e27bfe8681f9b6ef5154472a1c65e8f990040aae7fefec096f18f55cdefe340e816bf9bff37fec89ee64277f8d8a36327ca257638dfd923f2f20760bb3c81c08b4e0c6b9310cea0037c45018210e8c4061dddc6d357583dacafe5b8a173af39e4ac99"; // Dummy Data
        
        vm.startPrank(voter);
        opnVote.vote(electionID, voter, svsSignature, vote_encrypted, vote_encrypted_user, unblindedElectionToken, unblindedSignature);
        vm.stopPrank();

    }


}


