// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {OpnVote} from "../src/OpnVote.sol";

contract DeployScript is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivkey = vm.envUint("DEPLOYER_PRIV_KEY");
        address trustedForwarder = vm.envAddress("GELATO_TRUSTED_FORWARDER");

        vm.startBroadcast(deployerPrivkey);
        OpnVote opnVote = new OpnVote(trustedForwarder);
        console.log(address(opnVote));
    }
}
