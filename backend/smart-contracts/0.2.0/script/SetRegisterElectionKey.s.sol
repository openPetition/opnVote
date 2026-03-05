// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {OpnVote} from "../src/OpnVote.sol";

contract SetRegisterElectionKeyScript is Script {
    OpnVote opnVote;

    function setUp() public {
        opnVote = OpnVote(vm.envAddress("DEPLOYED_CONTRACT_ADDRESS"));
    }

    function run() public {
        uint256 electionId = 6;
        bytes memory registerElectionPubKeyE = vm.envBytes("REGISTER_ELECTION_0_E"); // Register e
        bytes memory registerElectionPubKeyN =
            hex"9b443f48ce9525d7de910c555ee1139ee3636ee3be9579b68d8c12376a7e70b2871fafc088b600d9df46c8541b1561402e5238b8b88681124ff8ecf8dda6389fde744c9e5969cc76fd8755dc6b46ed93bd61177afb29ae3c16da33ee83901109fc1462f8e80f9e4e66c7220561889c7452e515c1b71cf3e59d214a86e600803a57b96cecb05bf753931a3f6261df255c0a6f8b980a9fb6b1f33f0f8ff604d512753cde584c992ccf5fe0435cbff20761017105ca7ad8cd5d1427208645a752cdaf8217674dfdf4628b213cd4c046421a7d77cf3ff4c65e65a72d308ec49b84d9d9272ed42ff725d1acea589efee4d907e6c917fe462638f1b93ebb07f47f2f1d";
        console.log("electionId:", electionId);
        // console.log("register private key:", registerElectionPubKeyE);
        console.logBytes(registerElectionPubKeyE);
        console.logBytes(registerElectionPubKeyN);

        uint256 register = vm.envUint("REGISTER_PRIV_KEY");
        vm.startBroadcast(register);
        opnVote.setElectionRegisterPublicKey(electionId, registerElectionPubKeyN, registerElectionPubKeyE);
    }
}
