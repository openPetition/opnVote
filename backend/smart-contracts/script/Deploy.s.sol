// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {OpnVote} from "../src/OpnVote.sol";

contract DeployScript is Script {
    function setUp() public {}

    function run() public {
        uint256 deployer = vm.envUint("DEPLOYER_PRIV_KEY");
        vm.startBroadcast(deployer);
        OpnVote opnVote = new OpnVote();
        console.log(address(opnVote));
    }
}
