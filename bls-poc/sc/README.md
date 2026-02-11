# BLS Signature On-Chain Verification

On-chain BLS signature verification using EIP-2537 precompiles.

## How it works

1. Hash the raw message to a G1 curve point via RFC 9380 `hash_to_curve`
2. Pairing check: `e(sig, -G2_GEN) * e(H(msg), pk) == 1`

## Running

Requires Foundry **nightly >= 1.6.0** (revm with BLS12-381 precompile support).

---

### Learning 1: EIP-2537 precompile addresses were renumbered

The draft EIP-2537 had different addresses. In the final Pectra spec, `G1MUL` and `G2MUL`
were **removed entirely**, which shifted all subsequent addresses down.

| Precompile    | Draft address | Final (Pectra) address |
| ------------- | ------------- | ---------------------- |
| G1ADD         | 0x0a          | **0x0b**               |
| G1MSM         | 0x0b          | **0x0c**               |
| G2ADD         | 0x0c          | **0x0d**               |
| G2MSM         | 0x0d          | **0x0e**               |
| PAIRING       | 0x0e          | **0x0f**               |
| MAP_FP_TO_G1  | 0x12          | **0x10**               |
| MAP_FP2_TO_G2 | 0x13          | **0x11**               |

Most blog posts and older repos still use the old addresses.

### Learning 2: G2 point encoding order matters

EIP-2537 encodes G2 points as 256 bytes in this order:

```
x_c0 (64 bytes) || x_c1 (64 bytes) || y_c0 (64 bytes) || y_c1 (64 bytes)
```

Each coordinate is the 48-byte big-endian value **left-padded to 64 bytes**.
Getting the c0/c1 order wrong produces a valid-looking but incorrect point,
and the pairing silently returns the wrong result (no revert).

### Learning 3: The DST must include the scheme suffix

The hash-to-curve DST has **two parts**:

- The ciphersuite ID: `BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_` (39 bytes)
- The scheme suffix: `NUL_` (for basic scheme), `AUG_`, or `POP_`

Noble-curves (`@noble/curves`) uses the basic scheme by default, so its full DST is:

```
BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_   (43 bytes)
```

Our DST must match and use `NUL_`

### Learning 4: The MAP_FP_TO_G1 precompile includes cofactor clearing

The EIP-2537 `MAP_FP_TO_G1` precompile does **three things** in one call:

- Simplified SWU map
- 11-isogeny map
- Cofactor clearing

Noble-curves' `mapToCurve()` only does the first two (SWU + isogeny), without
cofactor clearing. So for the same field element input, they produce **different points**.

This doesn't matter for the final `hash_to_curve` result because:

- Contract: `clear(map(u0)) + clear(map(u1))` = `h*map(u0) + h*map(u1)` = `h*(map(u0) + map(u1))`
- Noble: `clear(map(u0) + map(u1))` = `h*(map(u0) + map(u1))`

Same result. But intermediate `mapToCurve` outputs
between noble and the precompile, will differ (expected).

### Learning 5: Point encoding (G1 and G2)

All points use **uncompressed** encoding with 48-byte coordinates **left-padded to 64 bytes**:

- G1: 128 bytes = x (64B) || y (64B)
- G2: 256 bytes = x_c0 (64B) || x_c1 (64B) || y_c0 (64B) || y_c1 (64B)

frontend/backend must pad coordinates to 64 bytes before passing them to the contract.

## Reference

- [EIP-2537: BLS12-381 precompiles](https://eips.ethereum.org/EIPS/eip-2537)
- [RFC 9380: Hashing to Elliptic Curves](https://www.rfc-editor.org/rfc/rfc9380)
- [revm BLS precompile addresses](https://github.com/bluealloy/revm) (`bls12_381_const.rs`)
- [noble-curves](https://github.com/paulmillr/noble-curves) (JS reference implementation)
