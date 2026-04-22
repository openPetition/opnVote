// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {OpnVote} from "../src/OpnVote.sol";

contract CancelElectionScript is Script {
    OpnVote opnVote;

    function setUp() public {
        opnVote = OpnVote(vm.envAddress("DEPLOYED_CONTRACT_ADDRESS"));
    }

    function run() public {
        uint256 electionId = vm.envUint("ELECTION_ID");
        string memory cancelReasonIpfsCid = vm.envString("CANCEL_REASON_CID");

        vm.startBroadcast();
        opnVote.cancelElection(electionId, cancelReasonIpfsCid);
    }
}
