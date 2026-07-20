// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {OpnVote} from "../src/OpnVote.sol";

contract PublishResultsScript is Script {
    OpnVote opnVote;

    function setUp() public {
        opnVote = OpnVote(vm.envAddress("DEPLOYED_CONTRACT_ADDRESS"));
    }

    function run() public {
        uint256 electionId = vm.envUint("ELECTION_ID");
        bytes memory privateKey = vm.envBytes("ELECTION_PRIVATE_KEY");

        // TODO: pass vote counts via env or JSON
        uint256[] memory yesVotes = new uint256[](3);
        uint256[] memory noVotes = new uint256[](3);
        uint256[] memory abstainVotes = new uint256[](3);
        uint256[] memory invalidVotes = new uint256[](3);
        uint256[] memory invalidTechnicalVotes = new uint256[](3);
        yesVotes[0] = 1;
        yesVotes[1] = 2;
        yesVotes[2] = 3;
        noVotes[0] = 4;
        noVotes[1] = 5;
        noVotes[2] = 6;
        abstainVotes[0] = 1;
        abstainVotes[1] = 0;
        abstainVotes[2] = 1;
        invalidVotes[0] = 0;
        invalidVotes[1] = 1;
        invalidVotes[2] = 2;
        invalidTechnicalVotes[0] = 0;
        invalidTechnicalVotes[1] = 0;
        invalidTechnicalVotes[2] = 1;

        vm.startBroadcast();
        opnVote.publishElectionResults(
            electionId, yesVotes, noVotes, abstainVotes, invalidVotes, invalidTechnicalVotes, privateKey
        );
    }
}
