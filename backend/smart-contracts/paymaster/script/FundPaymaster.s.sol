// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {OpnVotePaymaster} from "../src/OpnVotePaymaster.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";

contract FundPaymasterScript is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivkey = vm.envUint("DEPLOYER_PRIV_KEY");
        address payable paymasterAddr = payable(vm.envAddress("PAYMASTER_ADDRESS"));
        address entryPoint = vm.envAddress("ENTRY_POINT");
        uint256 depositAmount = vm.envUint("DEPOSIT_AMOUNT");
        uint256 stakeAmount = vm.envUint("STAKE_AMOUNT");
        uint32 unstakeDelaySec = uint32(vm.envUint("UNSTAKE_DELAY_SEC"));

        OpnVotePaymaster paymaster = OpnVotePaymaster(paymasterAddr);
        IEntryPoint ep = IEntryPoint(entryPoint);

        vm.startBroadcast(deployerPrivkey);

        paymaster.deposit{value: depositAmount}();
        console.log("Deposited (wei):", depositAmount);
        console.log("EntryPoint balance:", ep.balanceOf(address(paymaster)));

        paymaster.addStake{value: stakeAmount}(unstakeDelaySec);
        console.log("Staked (wei):", stakeAmount);
        console.log("Unstake delay (sec):", unstakeDelaySec);
    }
}
