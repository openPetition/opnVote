# Architecture Overview

The architecture combines on-chain transparency with off-chain services that manage eligibility, credentials, and transaction sponsorship. Everything is modular so individual components can evolve toward the fully decentralized design described in the long-term roadmap.

## Overview

<div class="mermaid-container">
<div class="mermaid">
flowchart LR
    classDef onchain fill:#1f77b4,stroke:#0d3a5c,color:#ffffff;
    classDef offchain fill:#2ca02c,stroke:#0f4c0f,color:#ffffff;
    classDef client fill:#ff7f0e,stroke:#a85300,color:#ffffff;
    classDef external fill:#9467bd,stroke:#5d3c92,color:#ffffff;

    subgraph Clients
        direction TB
        Voter[Voter Devices<br/>Frontend & SDK]
    end
    class Voter client;

    subgraph "Off-chain Services"
        direction TB
        AP[Authorization Provider]
        Register[Register Service]
        SVS[Signature Validation Server]
        IPFSService[IPFS Pinning Server]
        RPCGateway[RPC Gateway]
        GraphGateway[Graph Gateway]
    end
    class AP,Register,SVS,IPFSService,RPCGateway,GraphGateway offchain;

    subgraph "On-chain & Web3"
        direction TB
        Gelato[Gelato Relay]
        Contract[OpnVote.sol<br/>Gnosis Chain]
        SubgraphIndex[opn.vote Subgraph]
    end
    class Contract onchain;
    class Gelato,SubgraphIndex external;

    Voter -->|Eligibility JWT| AP
    AP -->|authorizeVoters| Contract

    Voter -->|Blinded token| Register
    Register -->|Blind signature| Voter

    Voter -->|Voting transaction| SVS
    SVS -->|Sponsored call| Gelato
    Gelato -->|Meta-transaction| Contract

    Voter -->|IPFS upload| IPFSService
    IPFSService -->|CID reference| Contract

    Voter -->|RPC calls| RPCGateway
    RPCGateway -->|Proxy| Contract

    Voter -->|GraphQL queries| GraphGateway
    GraphGateway -->|Queries| SubgraphIndex

    Contract -->|Events & state| SubgraphIndex
    SubgraphIndex -->|Read-only data| Voter

</div>
</div>

- **Smart contract layer**: `OpnVote.sol` on Gnosis mainnet stores election metadata, registration/authentication counters, and encrypted ballots. Tallying happens off-chain using the `votingSystem` library; decrypted results and the private key are published on-chain.
- **Authorization Provider (`backend/ap`)**: Accepts certified voter lists, persists pending authorizations in MariaDB and submits authorization batches to the contract.
- **Register service (`backend/register`)**: Issues blind signatures for voter tokens after validating JWTs (signed by Authorization Provider), checking election status, and ensuring no duplicate registrations, persisting signed credentials.
- **Signature Validation Server (`backend/svs`)**: Validates ballot payloads, signs them with the SVS key, and forwards voting transactions to Gelato.
- **Gateways**: Hardened JSON-RPC and GraphQL proxies with rate limiting and failover.
- **IPFS pinning server**: Authenticated service to upload election descriptions, providing CIDs referenced on-chain.
- **votingSystem**: The main package handling all cryptographic functions including client flows, credential management, encryption, and local tally tooling.

## Trust Boundaries (Current MVP)

- The smart contract is public and immutable; it cannot decrypt ballots or perform the final tally, but exposes recorded ballots and emits events for auditors.
- Authorization and Register services are permissioned operators holding private keys. Even though these roles remain centralized in the MVP, key actions are mirrored on-chain so they stay publicly auditable.
- The SVS holds a signing key; it ensures only eligible, properly signed ballots are relayed.
- Gelato Relay is an external sponsor. opn.vote relies on its uptime and non-censorship of transactions; future iterations will decentralize this layer.
- Anonymous submission channel is critical for voter privacy. The system assumes ballot submissions do not leak metadata (IP addresses, timing patterns) that could identify voters.
