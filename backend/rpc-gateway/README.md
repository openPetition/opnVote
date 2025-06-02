# RPC Gateway

Ethereum JSON-RPC gateway with automatic failover between multiple RPC endpoints.

## Setup

```bash
npm install
npm run build
```

Create `.env`:

```bash
PRIMARY_RPC_URL=https://primary-rpc-url
SECONDARY_RPC_URL=https://secondary-rpc-url
PORT=3000
```

Start:

```bash
npm start
```

## Usage

**RPC Endpoint:** `POST /` - Standard JSON-RPC requests  
**Health Check:** `GET /health` - Monitor endpoint status
