// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/CounterERC2771.sol";

contract CounterScript is Script {
    function setUp() public {}
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIV_KEY");
        address trustedForwarderGelato = 0xd8253782c45a12053594b9deB72d8e8aB2Fca54c;
        vm.startBroadcast(deployerPrivateKey);
        new CounterERC2771(trustedForwarderGelato);
    }
}
