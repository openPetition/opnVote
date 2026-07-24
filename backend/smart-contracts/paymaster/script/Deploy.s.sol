// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {OpnVotePaymaster, IOpnVote} from "../src/OpnVotePaymaster.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";

contract DeployScript is Script {
    function setUp() public {}

    function run() public {
        address verifyingSigner = vm.envAddress("VERIFYING_SIGNER");
        address entryPoint = vm.envAddress("ENTRY_POINT");
        address opnVote = vm.envAddress("OPNVOTE_CONTRACT_ADDRESS");

        // 0 = SIG_ONLY, 1 = SIG_OR_RULES, 2 = RULES_ONLY.
        uint256 sponsorMode = vm.envOr("SPONSOR_MODE", uint256(0));
        address accountImplementation = vm.envOr("ACCOUNT_IMPLEMENTATION_ADDRESS", address(0));
        uint256 maxOpsPerElection = vm.envOr("MAX_OPS_PER_ELECTION", uint256(0));
        uint256 maxCostCap = vm.envOr("MAX_COST_CAP", uint256(0));
        uint256 maxFeePerGasCap = vm.envOr("MAX_FEE_PER_GAS_CAP", uint256(0));

        require(sponsorMode <= 2, "invalid SPONSOR_MODE");
        require(maxOpsPerElection <= type(uint8).max, "MAX_OPS_PER_ELECTION > 255");

        vm.startBroadcast();

        OpnVotePaymaster paymaster = new OpnVotePaymaster(
            IEntryPoint(entryPoint),
            verifyingSigner,
            IOpnVote(opnVote),
            OpnVotePaymaster.SponsorMode(sponsorMode),
            accountImplementation,
            uint8(maxOpsPerElection),
            maxCostCap,
            maxFeePerGasCap
        );

        console.log("Paymaster deployed at:", address(paymaster));
        console.log("Sponsor mode:", sponsorMode);
    }
}
