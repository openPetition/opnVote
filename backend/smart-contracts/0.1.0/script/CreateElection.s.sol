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
        uint256 startTime = block.timestamp + 60;
        uint256 endTime = block.timestamp + 240;
        uint256 electionId = 0;
        uint256 registrationStartTime = 1811800800;
        uint256 registrationEndTime = 1811800800;

        uint8 apId = uint8(vm.envUint("AP_ID")); //0
        uint8 registerId = uint8(vm.envUint("REGISTER_ID")); //0
        uint8 svsId = uint8(vm.envUint("SVS_ID")); //0

        string memory descriptionIpfsCid = "QmQ7oksC4kpoKXNsN7BfHgZyUrWaAhuezeWi788Lt8izff";
        bytes memory electionPubKey =
            hex"30820122300d06092a864886f70d01010105000382010f003082010a0282010100b64fea1df6b657aead59b9fd81dc19bc8f301715bb1b86af0baf413a230e463e25fcd529ca0224303ae329a8996aa0b450bb916cd249329598016fa6dede402c4acbba02e013364ba7364c2c776d6cdd0e9d330a6816b24b50bc9e9e0a3aaecbbc799bf6c7543760a40a660234f47321d31823e7785c28201c432ae4a8f0fd8fd18c20aaf4570b4fb1f85c452d9417216ac178d31ece1684b9a7822be2536f253286d9f01aae2cbfedaa7f854eab2c1d81c1807cf19019fbca9cd7e4ed94b03dfbc99d01f04ff095da4a69ef6b3b7af245a8f7686c00c5e6b8e2cb4a99acb17dbe609673ce8b49665ef1a1b6cd2dd30a4bdb033ee9ac4c577d24ec2280d668650203010001";
        console.log("apId:", apId);
        console.log("registerId:", registerId);
        console.log("svsId:", svsId);
        console.log("description cid:", descriptionIpfsCid);
        console.logBytes(electionPubKey);
        uint256 deployer = vm.envUint("DEPLOYER_PRIV_KEY");
        vm.startBroadcast(deployer);
        opnVote.createOrUpdateElection(
            electionId,
            startTime,
            endTime,
            registrationStartTime,
            registrationEndTime,
            registerId,
            apId,
            svsId,
            descriptionIpfsCid,
            electionPubKey
        );
    }
}
