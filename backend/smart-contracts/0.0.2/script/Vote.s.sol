// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {OpnVote} from "../src/OpnVote.sol";
import "../src/Structs.sol";

contract VoteScript is Script {
    OpnVote opnVote;

    function setUp() public {
        opnVote = OpnVote(vm.envAddress("DEPLOYED_CONTRACT_ADDRESS"));
    }

    // Voting with Dummy data & valid SVS Signature
    function run() public {
        address voter = vm.envAddress("VOTER_ADDRESS");
        bytes memory svsSignature =
            hex"b84f0b06b966a70429b6fe23e6d51055c4d03b53237b6a0031aab48bbfce5bd2039c88b395fd5f1aaf00b842c8b4a55039216d5327670eb1887b7473a4a53f3d1b"; //Valid Signature

        bytes memory unblindedElectionToken = hex"0d00c14777a356fe09e16c92a8e0dca9fbf0aed4ef95ece383e03de3fe860f79"; // Dummy data
        bytes memory unblindedSignature =
            hex"12d6d3f3f695b2d9858596982b04f91249aff17d018a7ef3909bcfe91acf611fb133109ac1e5c85478b4248a24498651aa9c5db09836c4b4343ff5c2b643b6d7"; // Dummy data
        bytes memory vote_encrypted =
            hex"a8b2511c3fd5b7991438bae77d1c886a26c5938873352df14fe1eb592e6323fdc238ebb4e838dc6aedc01ec995ed7f9b0c24a6553418c6363419d6f7e50977bd6e92d022e1ff3c5d8b39ed62"; // Dummy Data
        bytes memory vote_encrypted_user =
            hex"a8b2511c3fd5b7991438bae77d1c886a26c5938873352df14fe1eb592e6323fdc238ebb4e838dc6aedc01ec995ed7f9b0c24a6553418c6363419d6f7e50977bd6e92d022e1ff3c5d8b39ed62"; // Dummy Data

        uint256 voterPrivKey = vm.envUint("VOTER_PRIV_KEY");
        vm.startBroadcast(voterPrivKey);
        opnVote.vote(0, voter, svsSignature, vote_encrypted, vote_encrypted_user, unblindedElectionToken, unblindedSignature);
    }
}
