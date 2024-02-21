// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {OpnVote} from "../src/OpnVote.sol";
import  "../src/Structs.sol";

contract SetRegisterElectionKeyScript is Script {
   OpnVote opnVote;

    function setUp() public {
        opnVote = OpnVote(vm.envAddress("DEPLOYED_CONTRACT_ADDRESS"));

    }


    function run() public {
        uint256 electionID = 0;
        bytes memory registerElectionPubKey = hex"11"; //todo Set Register Election Key

        uint256 register = vm.envUint("REGISTER_PRIV_KEY");
        vm.startBroadcast(register);
        opnVote.setElectionRegisterKey(electionID, registerElectionPubKey);

    }
}


