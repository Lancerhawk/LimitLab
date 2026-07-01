# Token Bucket Load Test

A backend load testing utility for verifying the Token Bucket rate limiter implementations under various request patterns.

## Architectures

LimitLab provides TWO distinct implementations of the Token Bucket algorithm to serve different purposes. Both use the exact same pure algorithm logic (`processTokenBucket`), but they utilize completely different storage backends.

### 1. Persistent Token Bucket
- **Endpoint**: `/api/v1/rate-limit`
- **Storage**: PostgreSQL (via Prisma)
- **Purpose**: Visualization, dashboard analytics, and educational implementation.
- **Advantages**: 
  - Survives server restarts.
  - Generates request logs and client statistics for the frontend dashboard.
  - Demonstrates complex concurrency handling (Optimistic Concurrency Control with retries).
- **Disadvantages**:
  - High latency (bound by database geographic distance).
  - High contention under simultaneous bursts due to OCC rollbacks.
- **Use Cases**: Ideal for learning, dashboard visualization, and low-throughput persistent rate limiting.

### 2. In-Memory Token Bucket
- **Endpoint**: `/api/v1/rate-limit/memory`
- **Storage**: Node.js Memory (via `Map`)
- **Purpose**: Extremely fast, production-style, database-less rate limiting.
- **Advantages**:
  - Virtually zero latency (no database or network overhead).
  - No Optimistic Concurrency Control (OCC) conflicts because memory updates are inherently synchronous in the Node.js event loop.
  - Automatically cleans up stale buckets after 30 minutes.
- **Disadvantages**:
  - State is lost if the server restarts.
  - Does not log requests for the dashboard.
- **Use Cases**: Load testing, real-time high-throughput API gateways, and pure algorithmic verification. *Most production API gateways use a memory-backed or Redis-backed implementation like this to handle thousands of requests per second.*

## Configuration

The script reads from `backend/.env`. If you want to test against a different environment, edit `backend/.env`:

```env
API_BASE_URL=http://localhost:3001
```

By default, the load test targets the **In-Memory Token Bucket** using the `x-client-id` header to identify independent buckets. No API key is required. The bucket is configured with:

| Setting      | Value        |
|--------------|--------------|
| Capacity     | 10           |
| Refill Rate  | 1 token/sec  |

## Running

From the `backend` directory:

```bash
npm run test:load
```

## Test Scenarios

| Test | Requests | Method          | Expected                            |
|------|----------|-----------------|-------------------------------------|
| 1    | 10       | Simultaneous    | 10 ALLOW, 0 DENY                    |
| 2    | 11       | Simultaneous    | 10 ALLOW, 1 DENY                    |
| 3    | 20       | Simultaneous    | 10 ALLOW, 10 DENY                   |
| 4    | 15       | 100ms delay     | 11 ALLOW, 4 DENY                    |
| 5    | 10       | 600ms delay     | 10 ALLOW, 0 DENY                    |
| 6    | 10       | 1000ms delay    | 10 ALLOW, 0 DENY                    |
| 7    | 100      | 600ms delay     | Mix of ALLOW and DENY               |

Between each test, the script waits 12 seconds for the bucket to fully refill.

## Understanding Results

### PASS
The test produced the exact number of ALLOWs and DENYs that the Token Bucket algorithm should produce given the configured capacity and refill rate.

### FAIL
The observed results did not match expectations. This could indicate concurrency bugs, incorrect configuration, or database contention (if testing the persistent endpoint).

## Output

Each test prints aggregate statistics including allowed/denied counts, latency, and duration. A final report summarizes all tests with an overall PASS/FAIL.
