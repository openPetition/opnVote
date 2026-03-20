// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {OpnVote} from "../src/OpnVote.sol";

contract SetRegisterElectionKeyScript is Script {
    OpnVote opnVote;

    function setUp() public {
        opnVote = OpnVote(vm.envAddress("DEPLOYED_CONTRACT_ADDRESS"));
    }

    function run() public {
        uint256 electionId = vm.envUint("ELECTION_ID");
        bytes memory registerElectionPubKeyE = vm.envBytes("REGISTER_ELECTION_E");
        bytes memory registerElectionPubKeyN = vm.envBytes("REGISTER_ELECTION_N");

        console.log("electionId:", electionId);
        console.logBytes(registerElectionPubKeyE);
        console.logBytes(registerElectionPubKeyN);

        vm.startBroadcast();
        opnVote.setElectionRegisterPublicKey(electionId, registerElectionPubKeyN, registerElectionPubKeyE);
    }
}
