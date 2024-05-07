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
        uint256 electionID = 4;
        bytes memory registerElectionPubKeyE = vm.envBytes("REGISTER_ELECTION_1_E"); // Register e
        bytes memory registerElectionPubKeyN = vm.envBytes("REGISTER_ELECTION_1_N"); // Register n
        
        uint256 register = vm.envUint("REGISTER_PRIV_KEY");
        vm.startBroadcast(register);
        opnVote.setElectionRegisterPublicKey(electionID, registerElectionPubKeyN, registerElectionPubKeyE);
    }
}


