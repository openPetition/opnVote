// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {OpnVote} from "../src/OpnVote.sol";
import "../src/Structs.sol";

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
        address voter = address(0xf9562D5EaC0ACFAe5274Aa30F7231d62818B593C);
        address voteSignedBy = address(0x847507B935658Bdf58F166E0B54C662Bc3942a6f);
        uint256 voteElectionID = 0;
        require(svsOwner == voteSignedBy, "Sig will be invalid. SVS and vote signee different");
        require(electionID == voteElectionID, "Sig will be invalid. Election ID not signed Election ID different");

        bytes memory svsSignature =
            hex"44cef31c9656d58689a9ecccb6a9554e24efba036f88839a882c5b072a838ce538be6823922424b7471c476b3a70fbe9d34c1f978d3bcd325f525f208da887471c"; //Valid Signature

        bytes memory unblindedElectionToken = hex"0d00c14777a356fe09e16c92a8e0dca9fbf0aed4ef95ece383e03de3fe860f79"; // Dummy data
        bytes memory unblindedSignature =
            hex"12d6d3f3f695b2d9858596982b04f91249aff17d018a7ef3909bcfe91acf611fb133109ac1e5c85478b4248a24498651aa9c5db09836c4b4343ff5c2b643b6d7"; // Dummy data
        
        //Dummy RSA encrypted vote
        bytes memory vote_encrypted =
            hex"a8b2511c3fd5b7991438bae77d1c886a26c5938873352df14fe1eb592e6323fdc238ebb4e838dc6aedc01ec995ed7f9b0c24a6553418c6363419d6f7e50977bd6e92d022e1ff3c5d8b39ed62f317fe06d7d118e1d3db7e6d111dfa88fedc0eaad30014c1d68c312426f2485821671a91afad6be65cfa0cc77edfb95c9ba9013ee6769d608aa51078b5bdd2e5825415881e4b3470da9af81298ed8416e08374ef0056a047d74e5d7e5245e444c29b757faf9cb49fd0abacf4f16534fb46c37d2810134002c987503c6371f9bc6900a6df2c9f8b2d686ebe5536e7caa3b8f160bc1ead3644e1493a380505cdd333dc9a6837f140b7251ff9fb9a30863b56d59981"; // Dummy Data
        
        bytes memory vote_encrypted_user =
            hex"a8b2511c3fd5b7991438bae77d1c886a26c5938873352df14fe1eb592e6323fdc238ebb4e838dc6aedc01ec995ed7f9b0c24a6553418c6363419d6f7e50977bd6e92d022e1ff3c5d8b39ed62f317fe06d7d118e1d3db7e6d111dfa88fedc0eaad30014c1d68c312426f2485821671a91afad6be65cfa0cc77edfb95c9ba9013ee6769d608aa51078b5bdd2e5825415881e4b3470da9af81298ed8416e08374ef0056a047d74e5d7e5245e444c29b757faf9cb49fd0abacf4f16534fb46c37d2810134002c987503c6371f9bc6900a6df2c9f8b2d686ebe5536e7caa3b8f160bc1ead3644e1493a380505cdd333dc9a6837f140b7251ff9fb9a30863b56d59981"; // Dummy Data
        
        vm.startPrank(voter);
        opnVote.vote(electionID, voter, svsSignature, vote_encrypted, vote_encrypted_user, unblindedElectionToken, unblindedSignature);
        vm.stopPrank();

    }


}


