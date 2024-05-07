// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {OpnVote} from "../src/OpnVote.sol";
import  "../src/Structs.sol";

contract CreateElectionScript is Script {
   OpnVote opnVote;

    function setUp() public {
        opnVote = OpnVote(vm.envAddress("DEPLOYED_CONTRACT_ADDRESS"));

    }


    function run() public {


        uint256 startTime = block.timestamp+60;
        uint256 endTime = block.timestamp+86400;

        uint8 apID = uint8(vm.envUint("AP_ID"));
        uint8 registerID = uint8(vm.envUint("REGISTER_ID"));
        uint8 svsID = uint8(vm.envUint("SVS_ID"));


        string memory descriptionIPFSCID = vm.envString("ELECTION_1_CID");
        bytes memory electionPubKey = vm.envBytes("ELECTION_1_PUBKEY");

        uint256 deployer = vm.envUint("DEPLOYER_PRIV_KEY");
        vm.startBroadcast(deployer);

        opnVote.createElection(startTime, endTime, registerID, apID, svsID, descriptionIPFSCID, electionPubKey);

    }
}

