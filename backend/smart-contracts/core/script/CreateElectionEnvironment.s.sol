// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {OpnVote} from "../src/OpnVote.sol";
import {AuthorizationProvider, Register} from "../src/Structs.sol";

contract CreateElectionEnvironmentScript is Script {
    OpnVote opnVote;

    function setUp() public {
        opnVote = OpnVote(vm.envAddress("DEPLOYED_CONTRACT_ADDRESS"));
    }

    function run() public {
        address apOwner = vm.envAddress("AP_OWNER_ADDRESS");
        uint8 apId = uint8(vm.envUint("AP_ID"));

        address registerOwner = vm.envAddress("REGISTER_OWNER_ADDRESS");
        uint8 registerId = uint8(vm.envUint("REGISTER_ID"));

        string memory apName = vm.envString("AP_NAME");
        string memory apUri = vm.envString("AP_URI");
        string memory registerName = vm.envString("REGISTER_NAME");
        string memory registerUri = vm.envString("REGISTER_URI");

        AuthorizationProvider memory ap = AuthorizationProvider(apId, apOwner, apName, apUri);
        Register memory register = Register(registerId, registerOwner, registerName, registerUri);

        vm.startBroadcast();

        opnVote.addAp(ap);
        opnVote.addRegister(register);
    }
}
