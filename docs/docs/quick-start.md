# Quick Start

<!-- opn.vote is designed with separable components. The election system requires only the smart contract deployment. Individual entities (Authorization Provider, Register Service, SVS) operate independently with their own databases and configurations. -->

## Repository Setup

<!-- ```bash
git clone https://github.com/your-org/opn.vote.git
cd opn.vote
npm install
``` -->

### Build votingSystem SDK

<!-- The shared `votingSystem` package is used by all services and the frontend:

```bash
cd votingSystem
npm install
npm run build
npm link             # expose the package for local consumers
cd ..
npm link votingsystem
``` -->

---

## Election System Setup

### Smart Contract Deployment

<!-- Deploy `OpnVote.sol` to Gnosis Chain:

```bash
cd backend/smart-contracts/0.1.0
forge install
forge test

# Deploy via Foundry scripts
forge script script/Deploy.s.sol --rpc-url <RPC_URL> --broadcast
```

Configure the contract with:
- Trusted forwarder address
- Register, AP, and SVS addresses
- Election parameters (timings, description CID) -->

### Optional: Gateway Services

<!-- RPC and Graph gateways provide rate limiting and failover. Skip if using your own infrastructure.

```bash
# RPC Gateway
npm run dev --workspace backend/rpc-gateway

# Graph Gateway
npm run dev --workspace backend/graph-gateway
```

Configure via `.env` files in `backend/rpc-gateway` and `backend/graph-gateway`. -->

### Optional: IPFS Pinning Server

<!-- Use this service or alternatives like Pinata for pinning election descriptions.

```bash
npm run dev --workspace backend/ipfs
```

Configure via `.env` in `backend/ipfs`. -->

---

## Authorization Provider Setup

<!-- The AP determines voter eligibility and authorizes voters on-chain. -->

### Prerequisites
<!-- - MariaDB instance
- Private key for signing authorization transactions -->

### Configuration

<!-- Copy and configure environment variables:
```bash
cd backend/ap
cp .env.sample .env
# Edit .env with DB credentials, private key, contract address, RPC endpoint
``` -->

### Run Service

<!-- ```bash
npm run dev --workspace backend/ap
``` -->

### Database
<!-- TypeORM auto-syncs in development. For production, use explicit migrations. -->

### Testing
<!-- ```bash
npm test --workspace backend/ap
``` -->

---

## Register Service Setup

<!-- The Register Service issues blind signatures for voter credentials. -->

### Prerequisites
<!-- - MariaDB instance
- Private key for blind signature issuance -->

### Configuration

<!-- ```bash
cd backend/register
cp .env.sample .env
# Edit .env with DB credentials, private key, contract address, RPC endpoint
``` -->

### Run Service

<!-- ```bash
npm run dev --workspace backend/register
``` -->

### Database
<!-- TypeORM auto-syncs in development. For production, use explicit migrations. -->

### Testing
<!-- ```bash
npm test --workspace backend/register
``` -->

---

## Signature Validation Server Setup

<!-- The SVS validates and signs voting transactions before relaying to Gelato. -->

### Prerequisites
<!-- - MariaDB instance
- Private key for EIP-191 signatures
- Gelato Relay API key -->

### Configuration

<!-- ```bash
cd backend/svs
cp .env.sample .env
# Edit .env with DB credentials, private key, contract address, RPC endpoint, Gelato config
``` -->

### Run Service

<!-- ```bash
npm run dev --workspace backend/svs
``` -->

### Database
<!-- TypeORM auto-syncs in development. For production, use explicit migrations. -->

### Testing
<!-- ```bash
npm test --workspace backend/svs
``` -->

---

## Frontend Client

<!-- The frontend provides the voter interface for registration, voting, and verification.

```bash
cd frontend/client
cp .env.local.sample .env.local
# Edit .env.local with contract address, service endpoints, RPC/Graph gateways
npm install
npm run dev
``` -->

---

## Common Troubleshooting

<!-- - **SDK not found**: Rerun `npm link votingsystem` after rebuilding the SDK
- **Database connection errors**: Verify MariaDB credentials and access
- **Contract interaction fails**: Check RPC endpoint and contract addresses in `.env` files
- **Preview docs locally**: Run `python3 -m mkdocs serve` inside `docs/` -->
