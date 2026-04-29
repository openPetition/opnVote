// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract BLSVerifier {
    address constant MODEXP       = address(0x05);
    address constant G1ADD        = address(0x0b);
    address constant PAIRING      = address(0x0f);
    address constant MAP_FP_TO_G1 = address(0x10);

    // DST must include scheme suffix to match noble-curves
    bytes constant DST = "BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_";

    bytes constant BLS_MODULUS =
        hex"000000000000000000000000000000001a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab";

    // -G2_GEN (negated y), encoding: x_c0, x_c1, -y_c0, -y_c1
    bytes constant NEG_G2_GENERATOR =
        hex"00000000000000000000000000000000024aa2b2f08f0a91260805272dc51051c6e47ad4fa403b02b4510b647ae3d1770bac0326a805bbefd48056c8c121bdb8"
        hex"0000000000000000000000000000000013e02b6052719f607dacd3a088274f65596bd0d09920b61ab5da61bbdc7f5049334cf11213945d57e5ac7d055d042b7e"
        hex"000000000000000000000000000000000d1b3cc2c7027888be51d9ef691d77bcb679afda66c73f17f9ee3837a55024f78c71363275a75d75d86bab79f74782aa"
        hex"0000000000000000000000000000000013fa4d4a0ad8b1ce186ed5061789213d993923066dddaf1040bc3ff59f825c78df74f2d75467e25e0f55f8a00fa030ed";

    function verify(
        bytes calldata message,
        bytes calldata signature,
        bytes calldata publicKey
    ) external view returns (bool) {
        require(signature.length == 128, "sig: 128 bytes");
        require(publicKey.length == 256, "pk: 256 bytes");

        bytes memory hm = hashToG1(message);

        // e(sig, -G2_GEN) * e(H(msg), pk) == 1
        (bool ok, bytes memory res) = PAIRING.staticcall(
            abi.encodePacked(signature, NEG_G2_GENERATOR, hm, publicKey)
        );
        require(ok, "pairing failed");
        return abi.decode(res, (uint256)) == 1;
    }

    function hashToG1(bytes calldata message) public view returns (bytes memory) {
        (bytes32 b1, bytes32 b2, bytes32 b3, bytes32 b4) = _expandMessageXmd(message);

        bytes memory u0 = _modReduceFp(abi.encodePacked(b1, b2));
        bytes memory u1 = _modReduceFp(abi.encodePacked(b3, b4));

        (bool ok1, bytes memory p1) = MAP_FP_TO_G1.staticcall(u0);
        require(ok1, "map1 failed");
        (bool ok2, bytes memory p2) = MAP_FP_TO_G1.staticcall(u1);
        require(ok2, "map2 failed");

        (bool ok3, bytes memory sum) = G1ADD.staticcall(abi.encodePacked(p1, p2));
        require(ok3, "g1add failed");
        return sum;
    }

    function _expandMessageXmd(
        bytes calldata msg_
    ) internal pure returns (bytes32, bytes32, bytes32, bytes32) {
        bytes memory dstPrime = abi.encodePacked(DST, uint8(43));

        bytes32 b0 = sha256(abi.encodePacked(
            new bytes(64), msg_, uint16(128), uint8(0), dstPrime
        ));

        bytes32 b1 = sha256(abi.encodePacked(b0, uint8(1), dstPrime));
        bytes32 b2 = sha256(abi.encodePacked(b0 ^ b1, uint8(2), dstPrime));
        bytes32 b3 = sha256(abi.encodePacked(b0 ^ b2, uint8(3), dstPrime));
        bytes32 b4 = sha256(abi.encodePacked(b0 ^ b3, uint8(4), dstPrime));

        return (b1, b2, b3, b4);
    }

    function _modReduceFp(bytes memory base) internal view returns (bytes memory) {
        (bool ok, bytes memory result) = MODEXP.staticcall(
            abi.encodePacked(
                uint256(64), uint256(1), uint256(64),
                base, uint8(1), BLS_MODULUS
            )
        );
        require(ok, "modexp failed");
        return result;
    }
}