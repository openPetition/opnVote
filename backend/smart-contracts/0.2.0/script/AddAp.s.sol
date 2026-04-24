// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {OpnVote} from "../src/OpnVote.sol";
import {AuthorizationProvider} from "../src/Structs.sol";

contract AddApScript is Script {
    OpnVote opnVote;

    function setUp() public {
        opnVote = OpnVote(vm.envAddress("DEPLOYED_CONTRACT_ADDRESS"));
    }

    function run() public {
        uint8 apId = uint8(vm.envUint("AP_ID"));
        address apOwner = vm.envAddress("AP_OWNER_ADDRESS");
        string memory apName = vm.envString("AP_NAME");
        string memory apUri = vm.envString("AP_URI");

        AuthorizationProvider memory ap = AuthorizationProvider(apId, apOwner, apName, apUri);

        vm.startBroadcast();
        opnVote.addAp(ap);
    }
}
