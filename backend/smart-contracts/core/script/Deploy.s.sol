// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {OpnVote} from "../src/OpnVote.sol";
import {BLSVerifier} from "../src/BLSVerifier.sol";

contract DeployScript is Script {
    function setUp() public {}

    function run() public {
        uint256 startId = vm.envUint("START_ID");

        vm.startBroadcast();
        BLSVerifier blsVerifier = new BLSVerifier();
        OpnVote opnVote = new OpnVote(startId, address(blsVerifier));
        console.log("BLSVerifier", address(blsVerifier));
        console.log("OpnVote", address(opnVote));
    }
}
