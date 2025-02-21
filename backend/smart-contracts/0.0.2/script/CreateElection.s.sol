// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {OpnVote} from "../src/OpnVote.sol";
import "../src/Structs.sol";

contract CreateElectionScript is Script {
    OpnVote opnVote;

    function setUp() public {
        opnVote = OpnVote(vm.envAddress("DEPLOYED_CONTRACT_ADDRESS"));
    }

    function run() public {
        uint256 startTime = block.timestamp + 1 minutes;
        uint256 endTime = block.timestamp + 730 days;

        uint8 apID = uint8(vm.envUint("AP_ID")); //0
        uint8 registerID = uint8(vm.envUint("REGISTER_ID")); //0
        uint8 svsID = uint8(vm.envUint("SVS_ID")); //0

        string memory descriptionIPFSCID = vm.envString("ELECTION_0_CID");
        bytes memory electionPubKey = vm.envBytes("ELECTION_0_PUBKEY"); 

        uint256 deployer = vm.envUint("DEPLOYER_PRIV_KEY");
        vm.startBroadcast(deployer);

        opnVote.createElection(
            startTime,
            endTime,
            registerID,
            apID,
            svsID,
            descriptionIPFSCID,
            electionPubKey
        );
    }
}
