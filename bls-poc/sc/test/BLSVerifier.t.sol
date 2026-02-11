// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {BLSVerifier} from "../src/BLSVerifier.sol";

contract BLSVerifierTest is Test {
    BLSVerifier verifier;

    address constant G1ADD = address(0x0b);
    address constant MAP_FP_TO_G1 = address(0x10);
    address constant PAIRING = address(0x0f);

    function setUp() public {
        verifier = new BLSVerifier();
    }

    function test_revert_badSignatureLength() public {
        vm.expectRevert("sig: 128 bytes");
        verifier.verify(hex"aa", new bytes(64), new bytes(256));
    }

    function test_revert_badPublicKeyLength() public {
        vm.expectRevert("pk: 256 bytes");
        verifier.verify(hex"aa", new bytes(128), new bytes(128));
    }

    function test_mapFpToG1_works() public view {
        bytes memory fp = new bytes(64);
        fp[63] = 0x01;

        (bool ok, bytes memory point) = MAP_FP_TO_G1.staticcall(fp);
        assertTrue(ok, "MAP_FP_TO_G1 should succeed");
        assertEq(point.length, 128, "G1 point should be 128 bytes");
    }

    function test_g1add_works() public view {
        bytes memory fp1 = new bytes(64);
        fp1[63] = 0x01;
        bytes memory fp2 = new bytes(64);
        fp2[63] = 0x02;

        (, bytes memory p1) = MAP_FP_TO_G1.staticcall(fp1);
        (, bytes memory p2) = MAP_FP_TO_G1.staticcall(fp2);

        (bool ok, bytes memory sum) = G1ADD.staticcall(abi.encodePacked(p1, p2));
        assertTrue(ok, "G1ADD should succeed");
        assertEq(sum.length, 128, "G1 sum should be 128 bytes");
    }

    function test_pairing_works() public view {
        // Map a field element to G1, use a known G2 point (the generator),
        // then check pairing(P, G2) with a single pair — should succeed.
        bytes memory fp = new bytes(64);
        fp[63] = 0x01;
        (, bytes memory g1Point) = MAP_FP_TO_G1.staticcall(fp);

        // G2 generator — EIP-2537 encoding order: x_c0, x_c1, y_c0, y_c1
        bytes memory g2Gen = hex"00000000000000000000000000000000024aa2b2f08f0a91260805272dc51051c6e47ad4fa403b02b4510b647ae3d1770bac0326a805bbefd48056c8c121bdb8"
            hex"0000000000000000000000000000000013e02b6052719f607dacd3a088274f65596bd0d09920b61ab5da61bbdc7f5049334cf11213945d57e5ac7d055d042b7e"
            hex"000000000000000000000000000000000ce5d527727d6e118cc9cdc6da2e351aadfd9baa8cbdd3a76d429a695160d12c923ac9cc3baca289e193548608b82801"
            hex"000000000000000000000000000000000606c4a02ea734cc32acd2b02bc28b99cb3e287e85a763af267492ab572e99ab3f370d275cec1da1aaa9075ff05f79be";

        // Single pair: G1 (128B) || G2 (256B) = 384 bytes
        bytes memory input = abi.encodePacked(g1Point, g2Gen);
        (bool ok, bytes memory res) = PAIRING.staticcall(input);
        assertTrue(ok, "pairing should succeed");
        // Single pair always returns 0 (not identity) — we just check it runs
        assertEq(res.length, 32, "pairing result should be 32 bytes");
    }

    // Verifies hashToG1 output matches noble-curves G1.hashToCurve()

    function test_hashToG1() public view {
        bytes memory message = hex"746869732069732074686520756e626c696e646564206d657373616765";
        bytes memory hm = verifier.hashToG1(message);

        bytes memory expected = hex"000000000000000000000000000000001356ee8c574e53fd81bbaef98150fda84681d6faf9ec1d39b43e9af5340b34da1d7d9f52415f3c2ee8e210013d534e19"
            hex"0000000000000000000000000000000002fcb95a36ed95a431ef3840f502d78752223108428248f945e2489e39ce90ccf09419f57bc26723098e2b2fdc69d242";

        assertEq(keccak256(hm), keccak256(expected), "hashToG1 should match noble-curves");
    }

    // ── Integration test ──────────────────────────────────────────────

    function test_verify_validSignature() public view {
        bytes memory message = hex"746869732069732074686520756e626c696e646564206d657373616765";
        bytes memory signature = hex"0000000000000000000000000000000003d29b5a4a49f85b737075564f5cb27b8612610985a9ac75a990fa31ab9eccab9404f7e6dab3a4d8ed18b003d5b9041a"
            hex"0000000000000000000000000000000010e4d053e7cdc6af091a37797823eca6c9e1db5cc82fcd65866fad34bc004f9aed50c52c5d9919d06c978dbc58f5f614";
        bytes memory publicKey = hex"00000000000000000000000000000000127b299689495194956f8b945fbde9ab8bceebff933d6d20cde673f883f8cf5c3e1d1d3d4d4b78b391c5f6126fcd7690"
            hex"0000000000000000000000000000000007f1d9fa69fc36595f9dd5a87e613d2da67001dc704d009c75506a6e030472ded0fbf03554468270609b5707ee7e9128"
            hex"00000000000000000000000000000000154fedd148174b5ee57485e9ddb33d697895f0953fcd07ec74877f3e1f9a8106a4c336b1662e102e0c539f621ec2612a"
            hex"000000000000000000000000000000000306fbe57fff06367fbb47f59e3bc93f0402e7bc309354c54caff12eff7e65389ae7015f9c45744b93343df7b27d3d8f";
        assertTrue(verifier.verify(message, signature, publicKey));
    }
}
