# opn.vote Documentation

opn.vote is a publicly verifiable e-voting system that addresses key challenges in blockchain voting. By leveraging Ethereum's Account Abstraction (EIP-4337), it allows citizens to cast and change their ballots without needing to install a crypto wallet or pay transaction fees (gas).

The protocol combines Schnorr blind signatures to ensure anonymity with the tamper-proof storage of ballots on a public blockchain. This makes every vote traceable and the entire system auditable by the public, without compromising voter privacy.

## Project Overview

- **On-chain** `OpnVote.sol` tracks elections, registration/auth counts, and encrypted ballots on Gnosis mainnet (MVP contract `0.1.0`). Tallying runs off-chain via the `votingSystem` library; decrypted results and keys are published on-chain.
- **Off-chain services** handle eligibility (Authorization Provider), blind-signature issuance (Register), Voting Transaction signing (SVS) + Gelato relay handling (SVS), and hardened RPC/Graph gateways.
- **votingSystem** is the main package handling all cryptographic functions used by frontend and backend services.
- **Design goals** center on privacy, eligibility enforcement, recastability, and auditability without forcing voters to manage wallets or gas.

## Documentation Map

- [Quick Start](quick-start.md)
- [Architecture Overview](architecture.md)
- [Election Lifecycle](lifecycle.md)
- [Deployments](deployments.md)
- [Roadmap](roadmap.md)

## Getting Help

- Raise an issue in the repository for bugs or documentation gaps.
- For integrations, audits, or research collaborations, email **info@opn.vote**.
