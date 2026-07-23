// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {OpnVotePaymaster, IOpnVote, I7702Account} from "../src/OpnVotePaymaster.sol";
import {EntryPoint} from "@account-abstraction/core/EntryPoint.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/interfaces/PackedUserOperation.sol";
import {IPaymaster} from "@account-abstraction/interfaces/IPaymaster.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract OpnVotePaymasterTest is Test {
    OpnVotePaymaster paymaster;
    EntryPoint entryPoint;

    address opnVote = makeAddr("opnVote");
    address accountImpl = makeAddr("accountImpl");
    address voter = makeAddr("voter");
    address svsSigner;
    uint256 svsKey;

    uint256 constant ELECTION_ID = 42;
    uint48 constant ELECTION_END = 1_800_000_000;
    uint256 constant MAX_COST_CAP = 0.1 ether;
    uint256 constant MAX_FEE_CAP = 100 gwei;
    uint8 constant MAX_OPS = 10;

    function setUp() public {
        (svsSigner, svsKey) = makeAddrAndKey("svs");
        entryPoint = new EntryPoint();

        vm.etch(opnVote, hex"00");

        paymaster = new OpnVotePaymaster(
            IEntryPoint(address(entryPoint)),
            svsSigner,
            IOpnVote(opnVote),
            OpnVotePaymaster.SponsorMode.SIG_ONLY,
            accountImpl,
            MAX_OPS,
            MAX_COST_CAP,
            MAX_FEE_CAP
        );

        vm.etch(voter, abi.encodePacked(hex"ef0100", accountImpl));

        mockCanVote(true, "", ELECTION_END);
    }

    function mockCanVote(bool ok, string memory reason, uint48 validUntil) internal {
        vm.mockCall(
            opnVote, abi.encodeWithSelector(IOpnVote.canVote.selector), abi.encode(ok, reason, validUntil)
        );
    }

    function voteCall() internal pure returns (bytes memory) {
        return abi.encodeWithSelector(IOpnVote.vote.selector, ELECTION_ID, new bytes(256), hex"11", new bytes(128));
    }

    function voteCallData(address target) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(I7702Account.execute.selector, target, uint256(0), voteCall());
    }

    function pmPrefix() internal view returns (bytes memory) {
        return abi.encodePacked(address(paymaster), uint128(250_000), uint128(50_000));
    }

    function buildUserOp() internal view returns (PackedUserOperation memory op) {
        op = PackedUserOperation({
            sender: voter,
            nonce: 0,
            initCode: "",
            callData: voteCallData(opnVote),
            accountGasLimits: bytes32((uint256(150_000) << 128) | uint256(350_000)),
            preVerificationGas: 200_000,
            gasFees: bytes32((uint256(1 gwei) << 128) | uint256(2 gwei)),
            paymasterAndData: pmPrefix(),
            signature: ""
        });
    }

    function signUserOp(PackedUserOperation memory op, uint48 validUntil, uint48 validAfter, uint256 key)
        internal
        view
        returns (PackedUserOperation memory)
    {
        op.paymasterAndData = pmPrefix();
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(paymaster.getHash(op, validUntil, validAfter));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        op.paymasterAndData = abi.encodePacked(pmPrefix(), abi.encode(validUntil, validAfter), r, s, v);
        return op;
    }

    function validate(PackedUserOperation memory op, uint256 maxCost)
        internal
        returns (bytes memory context, uint256 validationData)
    {
        vm.prank(address(entryPoint));
        return paymaster.validatePaymasterUserOp(op, bytes32(0), maxCost);
    }

    function sigFailed(uint256 validationData) internal pure returns (bool) {
        return uint160(validationData) == 1;
    }

    function validUntilOf(uint256 validationData) internal pure returns (uint48) {
        return uint48(validationData >> 160);
    }

    function enableRulesOnly() internal {
        paymaster.setMode(OpnVotePaymaster.SponsorMode.RULES_ONLY);
    }

    function test_SigOnly_ValidSignature() public {
        PackedUserOperation memory op = signUserOp(buildUserOp(), 1000, 500, svsKey);
        (bytes memory context, uint256 vd) = validate(op, 0.01 ether);

        assertFalse(sigFailed(vd));
        assertEq(validUntilOf(vd), 1000);
        assertEq(context.length, 0);
        assertEq(paymaster.sponsoredOps(voter, ELECTION_ID), 0);
    }

    function test_SigOnly_WrongSigner() public {
        (, uint256 wrongKey) = makeAddrAndKey("not-svs");
        PackedUserOperation memory op = signUserOp(buildUserOp(), 1000, 500, wrongKey);
        (, uint256 vd) = validate(op, 0.01 ether);

        assertTrue(sigFailed(vd));
    }

    function test_SigOnly_IgnoresRules() public {
        PackedUserOperation memory op = buildUserOp();
        op.callData = hex"dead";
        op = signUserOp(op, 1000, 500, svsKey);
        (, uint256 vd) = validate(op, 1 ether);

        assertFalse(sigFailed(vd));
    }

    function test_RulesOnly_HappyPath() public {
        enableRulesOnly();
        (bytes memory context, uint256 vd) = validate(buildUserOp(), 0.01 ether);

        assertFalse(sigFailed(vd));
        assertEq(validUntilOf(vd), ELECTION_END);
        (uint256 eid, address ctxVoter) = abi.decode(context, (uint256, address));
        assertEq(eid, ELECTION_ID);
        assertEq(ctxVoter, voter);
        assertEq(paymaster.sponsoredOps(voter, ELECTION_ID), 1);
    }

    function test_RulesOnly_CountsToLimitThenRejects() public {
        enableRulesOnly();
        for (uint256 i = 0; i < MAX_OPS; i++) {
            validate(buildUserOp(), 0.01 ether);
        }
        assertEq(paymaster.sponsoredOps(voter, ELECTION_ID), MAX_OPS);

        vm.expectRevert(abi.encodeWithSelector(OpnVotePaymaster.SponsorLimitReached.selector, ELECTION_ID, voter));
        validate(buildUserOp(), 0.01 ether);
    }

    function test_RulesOnly_CanVoteFalse() public {
        enableRulesOnly();
        mockCanVote(false, "Already voted", 0);

        vm.expectRevert(abi.encodeWithSelector(OpnVotePaymaster.VoteNotAllowed.selector, "Already voted"));
        validate(buildUserOp(), 0.01 ether);
    }

    function test_RulesOnly_CanVoteReverts() public {
        enableRulesOnly();
        vm.mockCallRevert(opnVote, abi.encodeWithSelector(IOpnVote.canVote.selector), "pairing failed");

        vm.expectRevert(OpnVotePaymaster.CanVoteCallFailed.selector);
        validate(buildUserOp(), 0.01 ether);
    }

    function test_RulesOnly_GasCaps() public {
        enableRulesOnly();

        vm.expectRevert(abi.encodeWithSelector(OpnVotePaymaster.MaxCostExceeded.selector, 1 ether, MAX_COST_CAP));
        validate(buildUserOp(), 1 ether);

        PackedUserOperation memory op = buildUserOp();
        op.gasFees = bytes32((uint256(1 gwei) << 128) | uint256(200 gwei));
        vm.expectRevert(abi.encodeWithSelector(OpnVotePaymaster.MaxFeePerGasExceeded.selector, 200 gwei, MAX_FEE_CAP));
        validate(op, 0.01 ether);
    }

    function test_RulesOnly_CallDataWhitelist() public {
        enableRulesOnly();
        PackedUserOperation memory op = buildUserOp();

        address wrongTarget = makeAddr("wrongTarget");
        op.callData = voteCallData(wrongTarget);
        vm.expectRevert(abi.encodeWithSelector(OpnVotePaymaster.TargetNotAllowed.selector, wrongTarget));
        validate(op, 0.01 ether);

        op.callData = abi.encodeWithSelector(bytes4(0x12345678), opnVote, uint256(0), hex"");
        vm.expectRevert(OpnVotePaymaster.CallDataNotAllowed.selector);
        validate(op, 0.01 ether);

        op.callData =
            abi.encodeWithSelector(I7702Account.execute.selector, opnVote, uint256(0), abi.encodeWithSelector(bytes4(0x12345678)));
        vm.expectRevert(OpnVotePaymaster.CallDataNotAllowed.selector);
        validate(op, 0.01 ether);

        op.callData = abi.encodeWithSelector(I7702Account.execute.selector, opnVote, uint256(1), voteCall());
        vm.expectRevert(abi.encodeWithSelector(OpnVotePaymaster.ValueNotAllowed.selector, 1));
        validate(op, 0.01 ether);
    }

    function test_RulesOnly_Delegation() public {
        enableRulesOnly();
        PackedUserOperation memory op = buildUserOp();

        op.sender = makeAddr("fresh-eoa");
        vm.expectRevert(abi.encodeWithSelector(OpnVotePaymaster.DelegationNotAllowed.selector, op.sender));
        validate(op, 0.01 ether);

        address wrongVoter = makeAddr("wrong-voter");
        vm.etch(wrongVoter, abi.encodePacked(hex"ef0100", makeAddr("other-impl")));
        op.sender = wrongVoter;
        vm.expectRevert(abi.encodeWithSelector(OpnVotePaymaster.DelegationNotAllowed.selector, wrongVoter));
        validate(op, 0.01 ether);
    }

    function test_SigOrRules_PathSelection() public {
        paymaster.setMode(OpnVotePaymaster.SponsorMode.SIG_OR_RULES);

        PackedUserOperation memory op = signUserOp(buildUserOp(), 1000, 500, svsKey);
        (bytes memory context, uint256 vd) = validate(op, 0.01 ether);
        assertFalse(sigFailed(vd));
        assertEq(validUntilOf(vd), 1000);
        assertEq(context.length, 0);
        assertEq(paymaster.sponsoredOps(voter, ELECTION_ID), 0);

        (context, vd) = validate(buildUserOp(), 0.01 ether);
        assertFalse(sigFailed(vd));
        assertEq(validUntilOf(vd), ELECTION_END);
        assertEq(paymaster.sponsoredOps(voter, ELECTION_ID), 1);
    }

    function test_SigOrRules_InvalidSignature_NoSilentFallback() public {
        paymaster.setMode(OpnVotePaymaster.SponsorMode.SIG_OR_RULES);
        (, uint256 wrongKey) = makeAddrAndKey("not-svs");
        PackedUserOperation memory op = signUserOp(buildUserOp(), 1000, 500, wrongKey);
        (, uint256 vd) = validate(op, 0.01 ether);

        assertTrue(sigFailed(vd));
        assertEq(paymaster.sponsoredOps(voter, ELECTION_ID), 0);
    }

    function test_RulesConfigGuard() public {
        vm.expectRevert(OpnVotePaymaster.RulesConfigIncomplete.selector);
        new OpnVotePaymaster(
            IEntryPoint(address(entryPoint)),
            svsSigner,
            IOpnVote(opnVote),
            OpnVotePaymaster.SponsorMode.RULES_ONLY,
            address(0),
            0,
            0,
            0
        );

        OpnVotePaymaster p = new OpnVotePaymaster(
            IEntryPoint(address(entryPoint)),
            svsSigner,
            IOpnVote(opnVote),
            OpnVotePaymaster.SponsorMode.RULES_ONLY,
            accountImpl,
            MAX_OPS,
            MAX_COST_CAP,
            MAX_FEE_CAP
        );
        assertEq(uint256(p.mode()), uint256(OpnVotePaymaster.SponsorMode.RULES_ONLY));

        OpnVotePaymaster fresh = new OpnVotePaymaster(
            IEntryPoint(address(entryPoint)),
            svsSigner,
            IOpnVote(opnVote),
            OpnVotePaymaster.SponsorMode.SIG_ONLY,
            address(0),
            0,
            0,
            0
        );
        vm.expectRevert(OpnVotePaymaster.RulesConfigIncomplete.selector);
        fresh.setMode(OpnVotePaymaster.SponsorMode.SIG_OR_RULES);
    }

    function test_Setters_OnlyOwner() public {
        vm.prank(makeAddr("stranger"));
        vm.expectRevert();
        paymaster.setMode(OpnVotePaymaster.SponsorMode.RULES_ONLY);
    }

    function test_PostOp_EmitsAccountingEvent() public {
        enableRulesOnly();
        (bytes memory context,) = validate(buildUserOp(), 0.01 ether);

        vm.expectEmit(true, true, false, true);
        emit OpnVotePaymaster.SponsoredVotePostOp(ELECTION_ID, voter, true, 12345);

        vm.prank(address(entryPoint));
        paymaster.postOp(IPaymaster.PostOpMode.opReverted, context, 12345, 1 gwei);
    }

    function test_InterfaceSelectorsMatchCanonicalSignatures() public pure {
        assertEq(I7702Account.execute.selector, bytes4(keccak256("execute(address,uint256,bytes)")));
        assertEq(I7702Account.execute.selector, bytes4(0xb61d27f6));
        assertEq(IOpnVote.vote.selector, bytes4(keccak256("vote(uint256,bytes,bytes,bytes)")));
    }
}
