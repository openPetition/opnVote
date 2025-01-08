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

        string memory descriptionIPFSCID = vm.envString("ELECTION_1_CID");
        bytes memory electionPubKey = vm.envBytes("ELECTION_1_PUBKEY"); // 0x30820122300d06092a864886f70d01010105000382010f003082010a0282010100a5ab902012b2cda81620ab60f95cd5dd4aa920ac019320d3a91927263f2c5d3cffbc97f07c432ce0b1e70a9ad1e20686b3a065ecf856c356aad312d33accea80927603ecd8edaf9bb0e0d9504bb78d44a29dc5ac949c1294ff4144411d722ebefe671e2151605ea3c8f50280165e0c0c5198771253fd638b18430855c91f292d6852688c1f0d395de53d0a91aa406de2678ed005a7c79e948204d5f6433c4fa663d7d59b8d61d2ddd148bb48cea457946feaaede9596d1caa34692456a55301d34c49443b7e7159b6db07b6358d59f18bbeddf5660e89b69b3a2bf924886cee5351eeae154401b01cc475dd7ce716ac10b0757c5afd8f5bc83f96ae612ccae7d0203010001

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
