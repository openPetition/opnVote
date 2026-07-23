// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@account-abstraction/core/BasePaymaster.sol";
import "@account-abstraction/core/Helpers.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";


interface IOpnVote {
    function canVote(
        uint256 electionId,
        address voter,
        bytes calldata voteEncrypted,
        bytes calldata voteEncryptedUser,
        bytes calldata unblindedSignature
    ) external view returns (bool ok, string memory reason, uint48 validUntil);

    function vote(
        uint256 electionId,
        bytes calldata voteEncrypted,
        bytes calldata voteEncryptedUser,
        bytes calldata unblindedSignature
    ) external;
}

interface I7702Account {
    function execute(address dest, uint256 value, bytes calldata func) external;
}

/// @title OpnVotePaymaster
/// @notice ERC-4337 Paymaster (EntryPoint v0.8).
contract OpnVotePaymaster is BasePaymaster {
    enum SponsorMode {
        SIG_ONLY,
        SIG_OR_RULES,
        RULES_ONLY
    }

    string public constant VERSION = "0.2.0";

    bytes4 private constant EXECUTE_SELECTOR = I7702Account.execute.selector;
    bytes4 private constant VOTE_SELECTOR = IOpnVote.vote.selector;
    uint256 private constant EIP7702_CODE_LENGTH = 23;

    uint256 private constant VALID_TIMESTAMP_OFFSET = PAYMASTER_DATA_OFFSET;
    uint256 private constant SIGNATURE_OFFSET = VALID_TIMESTAMP_OFFSET + 64;

    IOpnVote public immutable OPN_VOTE;

    address public verifyingSigner;
    SponsorMode public mode;
    address public accountImplementation; // expects EIP-7702 delegation target
    uint8 public maxOpsPerElection; // max sponsored ops (votes) per (voter, election)
    uint256 public maxCostCap; // max cost per op
    uint256 public maxFeePerGasCap; // max fee per gas per op

    mapping(address voter => mapping(uint256 electionId => uint8 count)) public sponsoredOps;

    event SignerChanged(address indexed oldSigner, address indexed newSigner);
    event ModeChanged(SponsorMode oldMode, SponsorMode newMode);
    event AccountImplementationChanged(address indexed oldImplementation, address indexed newImplementation);
    event MaxOpsPerElectionChanged(uint8 oldMax, uint8 newMax);
    event MaxCostCapChanged(uint256 oldCap, uint256 newCap);
    event MaxFeePerGasCapChanged(uint256 oldCap, uint256 newCap);
    event SponsoredVotePostOp(
        uint256 indexed electionId, address indexed voter, bool executionReverted, uint256 actualGasCost
    );

    error MaxCostExceeded(uint256 maxCost, uint256 cap);
    error MaxFeePerGasExceeded(uint256 maxFeePerGas, uint256 cap);
    error DelegationNotAllowed(address voter);
    error CallDataNotAllowed();
    error TargetNotAllowed(address target);
    error ValueNotAllowed(uint256 value);
    error SponsorLimitReached(uint256 electionId, address voter);
    error VoteNotAllowed(string reason);
    error CanVoteCallFailed();
    error RulesConfigIncomplete();

    constructor(
        IEntryPoint _entryPoint,
        address _verifyingSigner,
        IOpnVote _opnVote,
        SponsorMode _initialMode,
        address _accountImplementation,
        uint8 _maxOpsPerElection,
        uint256 _maxCostCap,
        uint256 _maxFeePerGasCap
    ) BasePaymaster(_entryPoint) {
        require(_verifyingSigner != address(0), "invalid signer");
        require(address(_opnVote) != address(0), "invalid opnvote address");
        verifyingSigner = _verifyingSigner;
        OPN_VOTE = _opnVote;

        if (_accountImplementation != address(0)) {
            emit AccountImplementationChanged(address(0), _accountImplementation);
            accountImplementation = _accountImplementation;
        }
        if (_maxOpsPerElection > 0) {
            emit MaxOpsPerElectionChanged(0, _maxOpsPerElection);
            maxOpsPerElection = _maxOpsPerElection;
        }
        if (_maxCostCap > 0) {
            emit MaxCostCapChanged(0, _maxCostCap);
            maxCostCap = _maxCostCap;
        }
        if (_maxFeePerGasCap > 0) {
            emit MaxFeePerGasCapChanged(0, _maxFeePerGasCap);
            maxFeePerGasCap = _maxFeePerGasCap;
        }
        if (_initialMode != SponsorMode.SIG_ONLY) {
            if (
                maxCostCap == 0 || maxFeePerGasCap == 0 || maxOpsPerElection == 0
                    || accountImplementation == address(0)
            ) {
                revert RulesConfigIncomplete();
            }
            emit ModeChanged(SponsorMode.SIG_ONLY, _initialMode);
            mode = _initialMode;
        }
    }

    function setVerifyingSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "invalid signer");
        emit SignerChanged(verifyingSigner, _newSigner);
        verifyingSigner = _newSigner;
    }

    function setMode(SponsorMode _newMode) external onlyOwner {
        if (
            _newMode != SponsorMode.SIG_ONLY
                && (
                    maxCostCap == 0 || maxFeePerGasCap == 0 || maxOpsPerElection == 0
                        || accountImplementation == address(0)
                )
        ) {
            revert RulesConfigIncomplete();
        }
        emit ModeChanged(mode, _newMode);
        mode = _newMode;
    }

    function setAccountImplementation(address _newImplementation) external onlyOwner {
        require(_newImplementation != address(0), "invalid implementation");
        emit AccountImplementationChanged(accountImplementation, _newImplementation);
        accountImplementation = _newImplementation;
    }

    function setMaxOpsPerElection(uint8 _newMax) external onlyOwner {
        require(_newMax > 0, "invalid max");
        emit MaxOpsPerElectionChanged(maxOpsPerElection, _newMax);
        maxOpsPerElection = _newMax;
    }

    function setMaxCostCap(uint256 _newCap) external onlyOwner {
        require(_newCap > 0, "invalid cap");
        emit MaxCostCapChanged(maxCostCap, _newCap);
        maxCostCap = _newCap;
    }

    function setMaxFeePerGasCap(uint256 _newCap) external onlyOwner {
        require(_newCap > 0, "invalid cap");
        emit MaxFeePerGasCapChanged(maxFeePerGasCap, _newCap);
        maxFeePerGasCap = _newCap;
    }

    function getHash(PackedUserOperation calldata userOp, uint48 validUntil, uint48 validAfter)
        public
        view
        returns (bytes32)
    {
        address sender = userOp.sender;
        return keccak256(
            abi.encode(
                sender,
                userOp.nonce,
                keccak256(userOp.initCode),
                keccak256(userOp.callData),
                userOp.accountGasLimits,
                uint256(bytes32(userOp.paymasterAndData[PAYMASTER_VALIDATION_GAS_OFFSET:PAYMASTER_DATA_OFFSET])),
                userOp.preVerificationGas,
                userOp.gasFees,
                block.chainid,
                address(this),
                validUntil,
                validAfter
            )
        );
    }

    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32, /*userOpHash*/
        uint256 maxCost
    )
        internal
        override
        returns (bytes memory context, uint256 validationData)
    {
        SponsorMode _mode = mode;

        bool useSigPath = _mode == SponsorMode.SIG_ONLY
            || (_mode == SponsorMode.SIG_OR_RULES && userOp.paymasterAndData.length > PAYMASTER_DATA_OFFSET);

        if (useSigPath) {
            (uint48 validUntil, uint48 validAfter, bytes calldata signature) =
                parsePaymasterAndData(userOp.paymasterAndData);

            require(signature.length == 64 || signature.length == 65, "invalid signature length");

            bytes32 hash = MessageHashUtils.toEthSignedMessageHash(getHash(userOp, validUntil, validAfter));
            bool sigFailed = verifyingSigner != ECDSA.recover(hash, signature);
            return ("", _packValidationData(sigFailed, validUntil, validAfter));
        }

        (uint256 electionId, uint48 ruleValidUntil) = _validateSponsorRules(userOp, maxCost);
        return (abi.encode(electionId, userOp.sender), _packValidationData(false, ruleValidUntil, 0));
    }

    function _validateSponsorRules(PackedUserOperation calldata userOp, uint256 maxCost)
        internal
        returns (uint256 electionId, uint48 validUntil)
    {
        if (maxCost > maxCostCap) revert MaxCostExceeded(maxCost, maxCostCap);

        uint256 maxFeePerGas = UserOperationLib.unpackMaxFeePerGas(userOp);
        if (maxFeePerGas > maxFeePerGasCap) revert MaxFeePerGasExceeded(maxFeePerGas, maxFeePerGasCap);

        address voter = userOp.sender;
        _requireDelegation(voter);

        (
            uint256 eid,
            bytes memory voteEncrypted,
            bytes memory voteEncryptedUser,
            bytes memory unblindedSignature
        ) = _parseVoteCallData(userOp.callData);
        electionId = eid;

        uint8 count = sponsoredOps[voter][electionId];
        if (count >= maxOpsPerElection) revert SponsorLimitReached(electionId, voter);
        sponsoredOps[voter][electionId] = count + 1;

        try OPN_VOTE.canVote(electionId, voter, voteEncrypted, voteEncryptedUser, unblindedSignature) returns (
            bool ok, string memory reason, uint48 voteValidUntil
        ) {
            if (!ok) revert VoteNotAllowed(reason);
            validUntil = voteValidUntil;
        } catch {
            revert CanVoteCallFailed();
        }
    }

    function _requireDelegation(address voter) internal view {
        bytes memory expected = abi.encodePacked(hex"ef0100", accountImplementation);
        bytes memory code = voter.code;
        if (code.length != EIP7702_CODE_LENGTH || keccak256(code) != keccak256(expected)) {
            revert DelegationNotAllowed(voter);
        }
    }

    function _parseVoteCallData(bytes calldata callData)
        internal
        view
        returns (uint256 electionId, bytes memory voteEncrypted, bytes memory voteEncryptedUser, bytes memory unblindedSignature)
    {
        if (callData.length < 4 || bytes4(callData[0:4]) != EXECUTE_SELECTOR) revert CallDataNotAllowed();

        (address target, uint256 value, bytes memory func) = abi.decode(callData[4:], (address, uint256, bytes));
        if (target != address(OPN_VOTE)) revert TargetNotAllowed(target);
        if (value != 0) revert ValueNotAllowed(value);
        if (func.length < 4) revert CallDataNotAllowed();

        bytes32 funcWord;
        assembly ("memory-safe") {
            funcWord := mload(add(func, 32))
        }
        if (bytes4(funcWord) != VOTE_SELECTOR) revert CallDataNotAllowed();

        bytes memory voteArgs = new bytes(func.length - 4);
        assembly ("memory-safe") {
            mcopy(add(voteArgs, 32), add(func, 36), mload(voteArgs))
        }
        (electionId, voteEncrypted, voteEncryptedUser, unblindedSignature) =
            abi.decode(voteArgs, (uint256, bytes, bytes, bytes));
    }


    function _postOp(PostOpMode _mode, bytes calldata context, uint256 actualGasCost, uint256 /*actualUserOpFeePerGas*/ )
        internal
        override
    {
        (uint256 electionId, address voter) = abi.decode(context, (uint256, address));
        emit SponsoredVotePostOp(electionId, voter, _mode == PostOpMode.opReverted, actualGasCost);
    }

    function parsePaymasterAndData(bytes calldata paymasterAndData)
        public
        pure
        returns (uint48 validUntil, uint48 validAfter, bytes calldata signature)
    {
        (validUntil, validAfter) = abi.decode(paymasterAndData[VALID_TIMESTAMP_OFFSET:], (uint48, uint48));
        signature = paymasterAndData[SIGNATURE_OFFSET:];
    }
}
