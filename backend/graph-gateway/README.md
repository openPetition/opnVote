# GraphQL Gateway

A GraphQL gateway to protect a subgraph endpoint with rate limiting and query size validation.

## What it does

- **Rate limiting**: 60 requests per minute per IP
- **Query size limiting**: Rejects queries over 10KB
- **Request timeout**: 10 second timeout on upstream requests

## Configuration

Create a `.env` file:

```bash
GRAPHQL_URL=https://your-subgraph-endpoint.com
TEST_API_KEY=your-test-key-here
PORT=3000
MAX_QUERY_SIZE=10000
REQUEST_TIMEOUT=10000
RPC_RATE_LIMIT_MAX=60
RPC_RATE_LIMIT_MAX_TEST=5000
```

## Running

```bash
npm install
npm run build
npm start
```

## Usage

Send GraphQL requests to `http://localhost:3000/`:

```bash
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"query": "{ elections { id } }"}'
```
