// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {OpnVotePaymaster} from "../src/OpnVotePaymaster.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";

contract DeployScript is Script {
    function setUp() public {}

    function run() public {
        address verifyingSigner = vm.envAddress("VERIFYING_SIGNER");
        address entryPoint = vm.envAddress("ENTRY_POINT");

        vm.startBroadcast();

        OpnVotePaymaster paymaster = new OpnVotePaymaster(IEntryPoint(entryPoint), verifyingSigner);

        console.log("Paymaster deployed at:", address(paymaster));
    }
}
