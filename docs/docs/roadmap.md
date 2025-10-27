# Roadmap

What's next for opn.vote beyond the current MVP.

## Cryptography

- Migrate from RSA blind signatures to Schnorr blind signatures for smaller signatures and stronger anonymity guarantees.
- Replace RSA encryption with EC ElGamal to reduce gas usage and align with the long-term security model.

## Account Abstraction & Relayers

- Phase out the dedicated SVS with native EIP-4337 account abstraction.
- Operate or integrate with a decentralized bundler network.

## Decentralizing Authorities

- Introduce blind multi-signatures so that registrar and authorization roles can be distributed across multiple parties.
- Expand audit tooling that proves registrar/AP actions without trusting a single operator.

## Anonymous Channels

- Build a native client that introduces randomized submission delays and supports direct connections to bundler nodes.
- Explore different approaches to eliminate metadata leakage at the relay layer.
