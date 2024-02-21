// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {OpnVote} from "../src/OpnVote.sol";
import  "../src/Structs.sol";

contract StartElectionScript is Script {
   OpnVote opnVote;

    function setUp() public {
        opnVote = OpnVote(vm.envAddress("DEPLOYED_CONTRACT_ADDRESS"));

    }


    function run() public {


        uint256 electionID = 0;


        uint256 deployer = vm.envUint("DEPLOYER_PRIV_KEY");
        vm.startBroadcast(deployer);
        opnVote.startElection(electionID);

    }
}


