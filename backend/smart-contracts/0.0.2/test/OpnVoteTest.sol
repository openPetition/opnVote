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
        address voter = address(0xe1f3A1e801b4A569296C79c1F08684A63Ea6540f);
        address voteSignedBy = address(0x847507B935658Bdf58F166E0B54C662Bc3942a6f);
        uint256 voteElectionID = 0;
        require(svsOwner == voteSignedBy, "Sig will be invalid. SVS and vote signee different");
        require(electionID == voteElectionID, "Sig will be invalid. Election ID not signed Election ID different");

        bytes memory svsSignature =
            hex"7f26e7c9dedb27e51e62cdde3788e3dbad1064da73dc2bc4763eb8d8ee56ba00769aac1006574fb1757de7672e3de527a8b6e672c644d0e9bf05cbbb0cb216071c"; //Valid Signature

        bytes memory unblindedElectionToken = hex"0a9b718b036919cfb9d629c7822fce5749d4be7f977a977d8f1861516fc8c359"; // Dummy data
        bytes memory unblindedSignature =
            hex"418f6cc8926bf388f9db10c5b310a586a0e5c643f91883214b94352e55f55637de44539c0bae5105c9bf49faaa571c381769725001e42284e73eb4dcb6958a0906f5c87077e509d1ee9ead7c124543d06d8dc809401f0de97f37b4682f81cf0bacc5337f0005e9bd8885dfed8e874b61ff2b6e703c244d6aa2b3c2bbc6b06bdc46d1c5420c7cbff816ff2347acfc04a8f99100f11fd2bcef43a4b217ec36c04bd6bb89f4ea13612451d245278398cb519dfbb8e5e18a90fc4c086787a7e53ca7af3c46b23060c5d039cfa391e41c33347c9336a4cd02017616d48fe5d473ac60e5f166f83246ebc7ef30bfbfad776ea10b8d45d9360f0e263c73ed586324a515"; // Dummy data
        
        //Dummy RSA encrypted vote
        bytes memory vote_encrypted =
            hex"69c109673471b28bd51433fcb059a7a059ab77428d7954db571944b78c32f204b967de6845a8113bb28745689d9c83ca17e711216bfe1cb225c2507c4105effc7c3260a7849d262baa36e1607bc1ec36474076c736d7540e69c56fadec316d7c620ca894f551fd81e76c405f627c2bdb5b75367a4592d4c9e14c647d473f9188683d0c2d1bcccf3858edaf7f387f235547262d67ff6773b85328199a2ca7c3add03c0d280b50ed9cba96d815fdda5dbd950ae95f537ff2c713462f24a70a781358f11a8cf658da97f98176d1f9362cbe3f9abd949b7606f9a004315727e0a74a63f588da2e3e3e24e08733d1a79bf6f91e3461aafe45fcdbcab531a9e98260da"; // Dummy Data
        
        bytes memory vote_encrypted_user =
            hex"aeded6601cb8739149c7bd2e73fce954351585911f86fbc1d25b61f8a89da94997"; // Dummy Data
        
        vm.startPrank(voter);
        opnVote.vote(electionID, voter, svsSignature, vote_encrypted, vote_encrypted_user, unblindedElectionToken, unblindedSignature);
        vm.stopPrank();

    }


}


