# BLS Blind Signature PoC

Spike to validate BLS blind signatures for on-chain voting using the Boldyreva scheme.

## Protocol

**Setup**: Signer has secret key `sk` and public key `pk = sk * G2` (on BLS12-381).

| Step        | Actor  | Operation                                                                    |
| ----------- | ------ | ---------------------------------------------------------------------------- |
| **Blind**   | User   | Pick random `r`, compute `M' = H(m) * r` where `H(m)` maps the message to G1 |
| **Sign**    | Signer | Compute blind signature `S' = sk * M'`                                       |
| **Unblind** | User   | Compute `S = S' * r⁻¹ = sk * H(m)` (a valid BLS sig on `m`)                  |
| **Verify**  | Anyone | Check `e(S, G2) == e(H(m), pk)` via pairing                                  |

The signer never sees `H(m)`, so the signature is unlinkable to the blinded request.

### Flow

1. **Frontend** hashes message `m`, picks random `r`, computes blinded point `M' = H(m) * r`, sends `M'` to backend
2. **Backend** generates fresh `sk`, computes `pk = sk * G2`, signs `S' = sk * M'`, returns `{ pk, S' }`
3. **Frontend** unblinds `S = S' * r⁻¹`, verifies locally via `e(S, G2) == e(H(m), pk)`
4. **Smart contract** exposes `verify(pk, msg, sig)` using BLS12-381 precompiles — takes `pk` as parameter
