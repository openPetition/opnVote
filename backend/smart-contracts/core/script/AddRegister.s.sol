// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {OpnVote} from "../src/OpnVote.sol";
import {Register} from "../src/Structs.sol";

contract AddRegisterScript is Script {
    OpnVote opnVote;

    function setUp() public {
        opnVote = OpnVote(vm.envAddress("DEPLOYED_CONTRACT_ADDRESS"));
    }

    function run() public {
        uint8 registerId = uint8(vm.envUint("REGISTER_ID"));
        address registerOwner = vm.envAddress("REGISTER_OWNER_ADDRESS");
        string memory registerName = vm.envString("REGISTER_NAME");
        string memory registerUri = vm.envString("REGISTER_URI");

        Register memory register = Register(registerId, registerOwner, registerName, registerUri);

        vm.startBroadcast();
        opnVote.addRegister(register);
    }
}
