// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {OpnVote} from "../src/OpnVote.sol";

contract EndElectionScript is Script {
    OpnVote opnVote;

    function setUp() public {
        opnVote = OpnVote(vm.envAddress("DEPLOYED_CONTRACT_ADDRESS"));
    }

    function run() public {
        uint256 electionId = 0;

        uint256 deployer = vm.envUint("DEPLOYER_PRIV_KEY");
        vm.startBroadcast(deployer);
        opnVote.endElection(electionId);
    }
}
