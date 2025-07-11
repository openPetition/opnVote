// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {OpnVote} from "../src/OpnVote.sol";
import "../src/Structs.sol";

contract SetRegisterElectionKeyScript is Script {
    OpnVote opnVote;

    function setUp() public {
        opnVote = OpnVote(address(0x8bacF711C8f7363eec8aE583aE5c70dA8214A23E));
    }

    function run() public {
        uint256 electionID = 0;
        bytes memory registerElectionPubKeyE = vm.envBytes(
            "REGISTER_ELECTION_0_E"
        ); // Register e
        bytes memory registerElectionPubKeyN = vm.envBytes(
            "REGISTER_ELECTION_0_N"
        ); // Register n

        uint256 register = vm.envUint("REGISTER_PRIV_KEY");
        vm.startBroadcast(register);
        opnVote.setElectionRegisterPublicKey(
            electionID,
            registerElectionPubKeyN,
            registerElectionPubKeyE
        );
    }
}