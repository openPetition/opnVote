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


        uint8 ballotLegth = 0;
        string memory descriptionIPFSHash = "IPFS"; //todo Set IPFS data
        string memory ballotIPFSHash = "IPFS"; //todo Set IPFS  data
        bytes memory electionPubKey = hex"11"; //todo Set Election Pub Key

        uint256 deployer = vm.envUint("DEPLOYER_PRIV_KEY");
        vm.startBroadcast(deployer);

        opnVote.createElection(startTime, endTime, registerID, apID, svsID,ballotLegth, descriptionIPFSHash, ballotIPFSHash, electionPubKey);

    }
}


