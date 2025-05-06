// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {OpnVote} from "../src/OpnVote.sol";
import  "../src/Structs.sol";

contract CreateElectionEnvironmentScript is Script {
   OpnVote opnVote;

    function setUp() public {
        opnVote = OpnVote(vm.envAddress("DEPLOYED_CONTRACT_ADDRESS"));

    }


    function run() public {

        address apOwner = vm.envAddress("AP_OWNER_ADDRESS");
        uint8 apID = uint8(vm.envUint("AP_ID"));

        address registerOwner = vm.envAddress("REGISTER_OWNER_ADDRESS");
        uint8 registerID = uint8(vm.envUint("REGISTER_ID"));

        address svsOwner = vm.envAddress("SVS_OWNER_ADDRESS");
        uint8 svsID = uint8(vm.envUint("SVS_ID"));

        AuthorizationProvider memory ap = AuthorizationProvider(apID, apOwner, "OpenPetition AP", "https://www.openpetition.de/ap/");
        Register memory register = Register(registerID, registerOwner, "OpenVote Register", "https://register.opn.vote");
        SignatureValidationServer memory svs =  SignatureValidationServer(svsID, svsOwner, "OpenVote SVS", "https://svs.opn.vote");
        
        uint256 deployer = vm.envUint("DEPLOYER_PRIV_KEY");
        vm.startBroadcast(deployer);

        opnVote.addAP(ap);
        opnVote.addRegister(register);
        opnVote.addSVS(svs);

    }
}

