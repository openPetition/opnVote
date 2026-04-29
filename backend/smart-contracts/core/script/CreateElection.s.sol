// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {OpnVote} from "../src/OpnVote.sol";

contract CreateElectionScript is Script {
    OpnVote opnVote;

    function setUp() public {
        opnVote = OpnVote(vm.envAddress("DEPLOYED_CONTRACT_ADDRESS"));
    }

    function run() public {
        uint256 electionId = vm.envUint("ELECTION_ID");
        uint256 startTime = vm.envUint("ELECTION_START_TIME");
        uint256 endTime = vm.envUint("ELECTION_END_TIME");
        uint256 registrationStartTime = vm.envUint("REGISTRATION_START_TIME");
        uint256 registrationEndTime = vm.envUint("REGISTRATION_END_TIME");

        uint8 apId = uint8(vm.envUint("AP_ID"));
        uint8 registerId = uint8(vm.envUint("REGISTER_ID"));

        string memory descriptionIpfsCid = vm.envString("ELECTION_CID");
        bytes memory electionPubKey = vm.envBytes("ELECTION_PUBKEY");

        vm.startBroadcast();
        opnVote.createOrUpdateElection(
            electionId,
            startTime,
            endTime,
            registrationStartTime,
            registrationEndTime,
            registerId,
            apId,
            descriptionIpfsCid,
            electionPubKey
        );
    }
}
