// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

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
            hex"e23198845b3b64a1c7c47eec1c395e9824b7e0e218518ca1f15dd2d8edf79e1f61e1b1d7c7ed2c9813e4ba82443de08a76b4dbf00896f01959242835bf4c808b1b"; //Valid Signature

        bytes memory unblindedElectionToken = hex"0cc0ff35213ca3b03758d1718889e053fdb4b42fe234dadfddc60e3c14e8dee0"; // Dummy data
        bytes memory unblindedSignature =
            hex"11111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111"; // Dummy data
        bytes memory vote_encrypted =
            hex"44e9d902d9e1605290ab0ec670a09b03e4a5cee37cdf3538da92eba7279700215eff4af12b21cf5ae102ee1ecdf1e5bc3e288917711acd6f063980d7bf46cf53e1304d3df19b0f39b2503d4b56066634d2a245e9c8f95d9ab4d37209e19ce863e9f73e37f8b8f8540abbde7fe7579286b3705bd1c3d8847f1eddad47b6fccd6bf9e28e6dad63bd830c3d0206218143e9301bb065dbeb1438416b47b4645c7d1e91662bff1b77ae3ac09aec76351e9c673b0ff0b6857cd416766619bc1e9843e15f841df35897f6eb2ef17d61d0eb03f267c0f17165e91b14301f4607596de7c159f2e31cbbe9c4eeac9ead209fd3880650217bd78450ecb61bfc12bd60817c6c"; // Dummy Data
        bytes memory vote_encrypted_user = hex"51146f0fd4e24449cf04f8bbeb62afb5754d4f10b3c2945b6534254221df67ae7c"; // Dummy Data

        uint256 voterPrivKey = vm.envUint("VOTER_PRIV_KEY");
        vm.startBroadcast(voterPrivKey);
        opnVote.vote(
            0, voter, svsSignature, vote_encrypted, vote_encrypted_user, unblindedElectionToken, unblindedSignature
        );
    }
}
