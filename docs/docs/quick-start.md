# Quick Start Guide

This guide walks you through setting up all components of the opnVote system from scratch. Follow these steps sequentially to get a complete working environment.

## Prerequisites

- **Node.js** (v20.x or later) and npm
- **MariaDB/MySQL** (v10.5 or later)
- **Foundry** for smart contract deployment ([installation guide](https://book.getfoundry.sh/getting-started/installation))
- **IPFS** daemon (optional, for IPFS pinning server)
- **Git** for cloning the repository

## Service Port Overview

This guide uses the following default ports:

| Service                | Port |
| ---------------------- | ---- |
| Frontend               | 3000 |
| Graph Gateway          | 3001 |
| RPC Gateway            | 3002 |
| IPFS Pinning Server    | 3003 |
| Register Service       | 3004 |
| SVS                    | 3005 |
| Authorization Provider | 3006 |

**Note**: You can customize these ports in each service's `.env` file to avoid conflicts with your existing services.

## Important: Directory Navigation

Throughout this guide, **all relative paths assume you are in the project root directory** (`opnVote/`). After completing each step, return to the project root before proceeding to the next step unless otherwise specified.

---

## 1. Repository Setup

### Clone the Repository

```bash
git clone https://github.com/openPetition/opnVote.git
cd opnVote
```

### Build the votingSystem SDK

The shared `votingSystem` package is used by all backend services and the frontend. You must build it first:

```bash
cd votingSystem
npm install
npm run build
cd ..  # Return to project root
```

This creates the compiled SDK in the `dist/` directory that will be referenced by all services.

---

## 2. Database Setup

All backend services (Register, AP, SVS) require their own MariaDB database.

### Create Databases

```sql
CREATE DATABASE oVote_register CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE oVote_ap CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE oVote_svs CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create a dedicated user (recommended)
CREATE USER 'ovote_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON oVote_register.* TO 'ovote_user'@'localhost';
GRANT ALL PRIVILEGES ON oVote_ap.* TO 'ovote_user'@'localhost';
GRANT ALL PRIVILEGES ON oVote_svs.* TO 'ovote_user'@'localhost';
FLUSH PRIVILEGES;
```

**Note**: TypeORM is configured with `synchronize: true` for development, which auto-creates tables. For production, disable this and use explicit migrations.

---

## 3. Smart Contract Deployment

### Prerequisites

- An Ethereum-compatible RPC endpoint (Gnosis Chain)
- A deployer wallet with native tokens for gas fees
- Gelato trusted forwarder address (for gasless transactions via Gelato Relay)

### Setup

```bash
cd backend/smart-contracts/0.1.0
```

### Install Dependencies

```bash
forge install
```

### Configure Environment

```bash
cp .env.sample .env
```

Edit `.env` with the following **required** fields:

```bash
# Deployer Configuration
DEPLOYER_PRIV_KEY=0x...                    # Private key with funds for deployment
DEPLOYER_ADDRESS=0x...                     # Deployer wallet address

# Gelato Configuration
GELATO_TRUSTED_FORWARDER=0xd8253782c45a12053594b9deB72d8e8aB2Fca54c  # Gnosis Mainnet
```

### Deploy the Contract

```bash
# Deploy to your target network
forge script script/Deploy.s.sol --rpc-url <YOUR_RPC_URL> --broadcast --verify
```

After deployment, note the **contract address** from the output. You'll need it for all services.

### Register Service Providers (AP, Register, SVS)

After deployment, register the service providers with the contract:

```bash
# Update .env with additional fields
DEPLOYED_CONTRACT_ADDRESS=0x...           # From deployment output

# AP Configuration
AP_OWNER_ADDRESS=0x...                     # Wallet that controls AP operations
AP_ID=1                                    # Unique ID for this AP

# Register Configuration
REGISTER_OWNER_ADDRESS=0x...               # Wallet that controls Register operations
REGISTER_ID=1                              # Unique ID for this Register

# SVS Configuration
SVS_OWNER_ADDRESS=0x...                    # Wallet that controls SVS operations
SVS_ID=1                                   # Unique ID for this SVS
```

```bash
# Register providers on-chain
forge script script/CreateElectionEnvironment.s.sol --rpc-url <YOUR_RPC_URL> --broadcast
```

---

## 4. Subgraph Deployment

The opnVote system requires a deployed subgraph to query blockchain data efficiently. The subgraph indexes events from the smart contract and provides a GraphQL API.

Deploy your own [Graph Node](https://github.com/graphprotocol/graph-node) following [The Graph's documentation](https://thegraph.com/docs/en/operating-graph-node/).

**Using the Subgraph Endpoint**:

Once deployed, configure the GraphQL endpoint in your services:

- **Graph Gateway** (if used): `GRAPHQL_ENDPOINT` in `backend/graph-gateway/.env`
- **Frontend**: `NEXT_PUBLIC_GRAPH_CONNECT_URL` in `frontend/client/.env.local`
- **Backend services**: `GRAPHQL_ENDPOINT` in AP, Register, and SVS `.env` files

Example endpoint: `http://localhost:8000/subgraphs/name/opnvote-prod-0x6d293d5F94cC92D3a8a73B3FAe498a790CbBFb90`

---

## 5. RPC Gateway Setup (Optional)

The RPC Gateway provides rate limiting, failover, and access control for blockchain RPC requests. **Only needed if you're running a local blockchain node.** If using a public RPC (Alchemy, Infura, etc.), skip this step.

### Prerequisites

- At least one Ethereum RPC endpoint (primary)
- Optionally, a secondary RPC endpoint for failover

### Setup

```bash
cd backend/rpc-gateway
npm install
```

### Configure Environment

```bash
cp .env.sample .env
```

**Required fields**:

```bash
# RPC Endpoints (at least PRIMARY_RPC_URL is required)
PRIMARY_RPC_URL=http://localhost:8545
SECONDARY_RPC_URL=https://rpc.ankr.com/gnosis

# API Key for testing (bypasses rate limits)
TEST_API_KEY=your_random_test_key_here

# Optional Configuration
REQUEST_TIMEOUT=10000                      # Timeout in milliseconds
RPC_RATE_LIMIT_MAX=60                     # Max requests per minute per IP
WHITELISTED_IPS=123.123.123.123,::1       # IPs with unlimited access
PORT=3002                                  # Server port
```

### Run the Service

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

The gateway will be available at `http://localhost:3002` (or your configured PORT).

**Usage**: Your services and frontend should use this gateway URL instead of direct RPC endpoints.

---

## 6. Graph Gateway Setup (Optional)

The Graph Gateway provides rate limiting and access control for GraphQL subgraph queries. **Only needed for production deployments.** For development, you can use the subgraph endpoint directly.

### Prerequisites

- A GraphQL endpoint URL for your deployed subgraph

### Setup

```bash
cd backend/graph-gateway
npm install
```

### Configure Environment

```bash
cp .env.sample .env
```

**Required fields**:

```bash
# GraphQL Endpoint (REQUIRED)
GRAPHQL_ENDPOINT=http://localhost:8000/subgraphs/name/opnvote-prod-0x6d293d5F94cC92D3a8a73B3FAe498a790CbBFb90

# API Key for testing (bypasses rate limits)
TEST_API_KEY=your_random_test_key_here

# Optional Configuration
REQUEST_TIMEOUT=10000                      # Timeout in milliseconds
MAX_QUERY_SIZE=10000                       # Max query size in bytes
PORT=3001                                  # Server port (using 3001 to avoid conflict with RPC Gateway)
WHITELISTED_IPS=                           # Comma-separated IPs with unlimited access
```

### Run the Service

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

---

## 7. IPFS Pinning Server Setup (Optional)

This service allows authorized election coordinators to pin election metadata to IPFS. Alternatively, use services like Pinata or Infura.

### Prerequisites

- Running IPFS daemon (local or remote)
- Authorized admin wallet addresses

### Install IPFS (if needed)

Follow the [official IPFS installation guide](https://docs.ipfs.tech/install/).

```bash
# Start IPFS daemon
ipfs daemon
```

### Setup

```bash
cd backend/ipfs
npm install
```

### Configure Environment

```bash
cp .env.sample .env
```

**Required fields**:

```bash
# IPFS Configuration (REQUIRED)
IPFS_API=http://127.0.0.1:5001           # IPFS API endpoint

# Server Configuration (REQUIRED)
SERVER_URL=http://localhost:3001         # Public URL for this service

# SSL Configuration (OPTIONAL - use if exposing publicly)
SSL_KEY_PATH=./keys/server.key
SSL_CERT_PATH=./keys/server.cert

# Port (OPTIONAL)
PORT=3003
```

### Configure Authorized Admins

Edit `src/admins.ts` to add authorized wallet addresses that can pin election data:

```typescript
export const allowedAuthors: Array<Admin> = [
  {
    walletAddress: '0xYourWalletAddress',
    name: 'Your Organization Name',
  },
]
```

### Run the Service

```bash
# Build and start
npm run build
npm start
```

**API Usage**: Send POST requests to `/pinElectionData` with election metadata and an Ethereum signature.

---

## 8. Authorization Provider (AP) Setup

The AP determines voter eligibility and authorizes voters on-chain. This is typically operated by the organization conducting the election.

### Prerequisites

- MariaDB database (created in step 2)
- Private key with funds for submitting authorization transactions
- JWT public key for verifying voter authentication (PEM format)
- Deployed smart contract address

### Setup

```bash
cd backend/ap
npm install
```

### Configure Environment

```bash
cp .env.sample .env
```

**Required fields**:

```bash
# Server Configuration (REQUIRED)
SERVER_URL=http://localhost:3006
GRAPHQL_ENDPOINT=http://localhost:3001    # Your Graph Gateway or direct subgraph URL

# JWT Public Key (REQUIRED)
AP_JWT_PUBLIC_KEY_PATH=./keys/ap_public.pem

# SSL Configuration (OPTIONAL)
# Leave empty if behind a reverse proxy with SSL
SSL_KEY_PATH=
SSL_CERT_PATH=
# Or provide paths if this instance handles SSL:
# SSL_KEY_PATH=./keys/server.key
# SSL_CERT_PATH=./keys/server.cert

# Database Configuration (REQUIRED)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=ovote_user
DB_PASSWORD=your_secure_password
DB_NAME=oVote_ap

# Blockchain Configuration (REQUIRED)
OPNVOTE_CONTRACT_ADDRESS=0x...            # From smart contract deployment
RPC_PROVIDER=http://localhost:3002        # Your RPC Gateway or direct RPC
PRIVATE_KEY=0x...                          # AP owner private key (has funds for gas)

# AP Identity (REQUIRED)
AP_ID=1                                    # Must match the ID registered on-chain

# Gas Configuration (REQUIRED for real networks)
MAX_FEE_PER_GAS_IN_GWEI=100
MAX_PRIORITY_FEE_PER_GAS_IN_GWEI=2

# Job Configuration (REQUIRED)
JOB_CRON_SCHEDULE=*/5 * * * *             # Runs every 5 minutes
BATCH_SIZE=100                             # Process 100 pending authorizations per batch

# Port (OPTIONAL)
PORT=3006
```

### Generate JWT Key Pair

If you don't have a JWT key pair, generate one now (while in the `backend/ap` directory):

```bash
# Create keys directory
mkdir -p keys

# Generate private key
openssl ecparam -name prime256v1 -genkey -noout -out keys/ap_private.pem

# Extract public key
openssl ec -in keys/ap_private.pem -pubout -out keys/ap_public.pem
```

**Important**: Register needs to know the JWT public key of AP. Copy `ap_public.pem` to the Register service:

```bash
# From backend/ap directory
mkdir -p ../register/keys
cp keys/ap_public.pem ../register/keys/ap_public.pem
```

### Run the Service

```bash
# Run the API server
npm run dev

# In a separate terminal, run the background job processor
npm run dev:jobs
```

The job processor automatically submits pending authorizations to the blockchain in batches.

**API Endpoints**:

- `GET /api-docs` - Swagger documentation
- `POST /api/authorize` - Request voter authorization

---

## 9. Register Service Setup

The Register Service issues blind signatures for voter credentials, preserving voter anonymity.

### Prerequisites

- MariaDB database (created in step 2)
- RSA key pair for blind signature (N, D, E parameters)
- JWT public key (same as AP's public key)
- Deployed smart contract address

### Setup

```bash
cd backend/register
npm install
```

### Configure Environment

```bash
cp .env.sample .env
```

**Required fields**:

```bash
# Server Configuration (REQUIRED)
SERVER_URL=http://localhost:3004
GRAPHQL_ENDPOINT=http://localhost:3001    # Your Graph Gateway or direct subgraph URL

# JWT Public Key (REQUIRED - same as AP)
AP_JWT_PUBLIC_KEY_PATH=./keys/ap_public.pem

# SSL Configuration (OPTIONAL)
SSL_KEY_PATH=
SSL_CERT_PATH=

# Database Configuration (REQUIRED)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=ovote_user
DB_PASSWORD=your_secure_password
DB_NAME=oVote_register

# Blockchain Configuration (REQUIRED)
OPNVOTE_CONTRACT_ADDRESS=0x...
RPC_PROVIDER=http://localhost:3002
PRIVATE_KEY=0x...                          # Register owner private key

# RSA Blind Signature Keys (REQUIRED for each election)
# Election ID 6 example:
REGISTER_ELECTION_6_N=0x...               # RSA modulus N (hex format)
REGISTER_ELECTION_6_D=0x...               # Private exponent D (hex format)
REGISTER_ELECTION_6_E=65537                # Public exponent E (typically 65537)
REGISTER_ELECTION_6_N_LENGTH=2048         # Bit length of N

# Gas Configuration (REQUIRED)
MAX_FEE_PER_GAS_IN_GWEI=100
MAX_PRIORITY_FEE_PER_GAS_IN_GWEI=2

# Job Configuration (REQUIRED)
JOB_CRON_SCHEDULE=*/5 * * * *
BATCH_SIZE=100

# Port (OPTIONAL)
PORT=3004
```

### Generate RSA Key Pair for Blind Signatures

Before starting the Register service, you need to generate RSA keys for blind signatures. Run this from the **project root directory**:

```bash
# Make sure you're in the project root (opnVote/)

cd votingSystem
node -e "
const { generateKeyPairRaw } = require('./dist/admin/generateRSAKeys');
const keys = generateKeyPairRaw();
console.log('REGISTER_ELECTION_X_N=0x' + keys.N.toString(16));
console.log('REGISTER_ELECTION_X_D=0x' + keys.D.toString(16));
console.log('REGISTER_ELECTION_X_E=' + keys.e.toString());
console.log('REGISTER_ELECTION_X_N_LENGTH=' + keys.NbitLength);
"
cd ..  # Return to project root
```

Copy the output and add these values to `backend/register/.env`, replacing `X` with your election ID (e.g., `0`, `1`, `6`, etc.).

### Run the Service

Navigate back to the Register service directory and start the services:

```bash
cd backend/register

# Run the API server
npm run dev

# In a separate terminal, run the background job processor (from backend/register)
npm run dev:jobs
```

**Important**: The blind signature keys must be registered on the smart contract before voters can use them. Use the `SetRegisterElectionKey.s.sol` script.

---

## 10. Signature Validation Server (SVS) Setup

The SVS validates voting transactions and relays them to the blockchain via Gelato for gasless voting.

### Prerequisites

- MariaDB database (created in step 2)
- Gelato Relay API key ([get one here](https://relay.gelato.network/))
- Private key for EIP-191 signature validation
- Deployed smart contract address

### Setup

```bash
cd backend/svs
npm install
```

### Configure Environment

```bash
cp .env.sample .env
```

**Required fields**:

```bash
# Server Configuration (REQUIRED)
SERVER_URL=http://localhost:3005
GRAPHQL_ENDPOINT=http://localhost:3001

# SSL Configuration (OPTIONAL)
SSL_KEY_PATH=
SSL_CERT_PATH=

# SVS Signing Key (REQUIRED)
SVS_SIGN_KEY=0x...                        # Private key for signing vote validations

# Gelato Configuration (REQUIRED)
GELATO_SPONSOR_API_KEY=your_gelato_api_key_here

# Database Configuration (REQUIRED)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=ovote_user
DB_PASSWORD=your_secure_password
DB_NAME=oVote_svs

# Blockchain Configuration (REQUIRED)
CHAIN_ID=100                              # 100 for Gnosis Chain
OPNVOTE_CONTRACT_ADDRESS=0x...
RPC_PROVIDER=http://localhost:3002

# Gelato Queue Configuration (REQUIRED)
GELATO_USE_QUEUE=true                     # Use queue for reliability
GELATO_MAX_FORWARDS=2                     # Max concurrent Gelato requests

# Gelato Rate Limiting (REQUIRED if using queue)
GELATO_RATE_LIMIT=1                       # Requests per time window
GELATO_PROCESSING_INTERVAL=1000           # Time window in ms
GELATO_MAX_RETRIES=3
GELATO_RETRY_DELAY=5000                   # Delay between retries in ms
GELATO_STATUS_UPDATE_INTERVAL=1000        # Status check interval in ms

# Port (OPTIONAL)
PORT=3005
```

### Obtain Gelato API Key

1. Visit [Gelato Relay](https://relay.gelato.network/)
2. Connect your wallet
3. Create a new relay app
4. Copy the API key (1Balance Sponsor Key)
5. Fund your Gelato balance with native tokens on your target chain

### Run the Service

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

The SVS handles vote submission via Gelato's gasless relay network, ensuring voters don't need to pay gas fees.

---

## 11. Frontend Setup

The frontend provides the voter interface for registration, voting, and verification.

### Prerequisites

- All backend services running
- Smart contract deployed
- RPC and Graph gateways configured

### Setup

```bash
cd frontend/client
npm install
```

### Configure Environment

```bash
# Copy the development environment file
cp .env.development .env.local
```

Edit `.env.local` with your configuration. **Required fields**:

```bash
NEXT_PUBLIC_BASIC_URL="http://localhost:3000"
NEXT_PUBLIC_ABI_CONFIG_URL="http://localhost:3000/api/abi.json"

# Register Service (blind signatures)
NEXT_PUBLIC_BLINDED_SIGNATURE_URL="http://localhost:3004/api/sign"

# SVS Service URLs
NEXT_PUBLIC_SIGN_VOTING_TRANSACTION_URL="http://localhost:3005/api/votingTransaction/sign"
NEXT_PUBLIC_GELATO_FORWARD_URL="http://localhost:3005/api/gelato/forward"
NEXT_PUBLIC_GELATO_VERIFY_URL="http://localhost:3005/api/gelato/verify/"

# Graph Gateway
NEXT_PUBLIC_GRAPH_CONNECT_URL="http://localhost:3001"  # Your Graph Gateway URL

# RPC Gateway
NEXT_PUBLIC_RPC_NODE_URL="http://localhost:3002"  # Your RPC Gateway URL

# Contract Address
NEXT_PUBLIC_OPN_VOTE_CONTRACT_ADDRESS="0x..."  # From smart contract deployment
```

**Note**: The example above uses different ports for RPC (3002) and Graph (3001) gateways to avoid conflicts, as both default to port 3000.

### Run the Frontend

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

Access the application at `http://localhost:3000` (or configured port).

---

## 12. Create an Election

Once all services are running, you can create an election using the smart contract scripts.

### Configure Election Parameters

Navigate to the smart contracts directory from the project root:

```bash
cd backend/smart-contracts/0.1.0
```

Edit `script/CreateElection.s.sol` or set environment variables in the `.env` file:

```bash
# In backend/smart-contracts/0.1.0/.env file
ELECTION_0_CID=QmYourElectionMetadataCID    # From IPFS pinning server
ELECTION_0_PUBKEY=0x3082...                 # RSA public key (DER format)
```

### Deploy Election

```bash
forge script script/CreateElection.s.sol --rpc-url <YOUR_RPC_URL> --broadcast
```

---

## Quick Reference: Service Start Commands

Once everything is configured, here's a quick reference for starting all services:

```bash
# Terminal 1: RPC Gateway
cd backend/rpc-gateway && npm run dev

# Terminal 2: Graph Gateway
cd backend/graph-gateway && npm run dev

# Terminal 3: IPFS (optional)
cd backend/ipfs && npm run build && npm start

# Terminal 4: Authorization Provider
cd backend/ap && npm run dev

# Terminal 5: Authorization Provider Jobs
cd backend/ap && npm run dev:jobs

# Terminal 6: Register Service
cd backend/register && npm run dev

# Terminal 7: Register Service Jobs
cd backend/register && npm run dev:jobs

# Terminal 8: SVS
cd backend/svs && npm run dev

# Terminal 9: Frontend
cd frontend/client && npm run dev
```
