# Rate Limiter Load Tests

Backend load testing utilities for verifying LimitLab's rate limiter implementations under various request patterns.

## Architectures

LimitLab provides TWO distinct rate limiting algorithms, each with TWO storage backends. All four combinations use the same pure algorithm logic but utilize completely different storage backends.

### Algorithms

#### Token Bucket
- Smoothly refills tokens over time at a configurable rate.
- Allows bursts up to the bucket capacity, then throttles.
- Best for APIs that want to allow short bursts while enforcing a sustained average rate.

#### Fixed Window
- Divides time into fixed intervals (e.g., 60 seconds).
- Counts requests within each window and rejects once the limit is reached.
- Counter resets to zero at the start of each new window.
- Simpler to understand and implement, but susceptible to the "boundary burst" problem where 2x the limit can pass if requests cluster around a window boundary.

### Storage Backends

#### 1. Persistent (PostgreSQL)
- **Token Bucket Endpoint**: `/api/v1/rate-limit`
- **Fixed Window Endpoint**: `/api/v1/rate-limit/fixed-window`
- **Storage**: PostgreSQL (via Prisma)
- **Purpose**: Visualization, dashboard analytics, and educational implementation.
- **Advantages**: Survives server restarts. Generates request logs and client statistics for the frontend dashboard. Demonstrates complex concurrency handling (Optimistic Concurrency Control with retries).
- **Disadvantages**: High latency (bound by database geographic distance). High contention under simultaneous bursts due to OCC rollbacks.
- **Use Cases**: Learning, dashboard visualization, and low-throughput persistent rate limiting.

#### 2. In-Memory
- **Token Bucket Endpoint**: `/api/v1/rate-limit/memory`
- **Fixed Window Endpoint**: `/api/v1/rate-limit/fixed-window/memory`
- **Storage**: Node.js Memory (bounded LRU Map, max 100,000 entries)
- **Purpose**: Extremely fast, production-style, database-less rate limiting.
- **Advantages**: Virtually zero latency. No OCC conflicts. Automatically cleans up stale entries after 30 minutes.
- **Disadvantages**: State is lost if the server restarts. Does not log requests for the dashboard.
- **Use Cases**: Load testing, real-time high-throughput API gateways, and pure algorithmic verification.

## Configuration

Both test scripts read from `backend/.env`:

```env
API_BASE_URL=http://localhost:3001
```

### Token Bucket Defaults (In-Memory)

| Setting      | Value        |
|--------------|--------------|
| Capacity     | 10 tokens    |
| Refill Rate  | 1 token/sec  |

### Fixed Window Defaults (In-Memory)

| Setting          | Value        |
|------------------|--------------|
| Request Limit    | 10 requests  |
| Window Duration  | 60 seconds   |

## Running

From the `backend` directory:

```bash
# Token Bucket load tests
npm run test:load

# Fixed Window load tests
npm run test:load:fw
```

## Token Bucket Test Scenarios

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

## Fixed Window Test Scenarios

| Test | Requests | Method                        | Expected                            |
|------|----------|-------------------------------|-------------------------------------|
| 1    | 10       | Simultaneous                  | 10 ALLOW, 0 DENY                    |
| 2    | 11       | Simultaneous                  | 10 ALLOW, 1 DENY                    |
| 3    | 20       | Simultaneous                  | 10 ALLOW, 10 DENY                   |
| 4    | 10 + 10  | Two bursts across window edge | 20 ALLOW, 0 DENY (window reset)     |
| 5    | 100      | 100ms delay                   | Counter never exceeds limit          |

Test 4 waits for the current window to end before sending the second batch to verify the counter resets correctly.

## Understanding Results

### PASS
The test produced the exact number of ALLOWs and DENYs that the algorithm should produce given the configured parameters.

### FAIL
The observed results did not match expectations. This could indicate concurrency bugs, incorrect configuration, or database contention (if testing the persistent endpoint).

## Output

Each test prints aggregate statistics including allowed/denied counts, latency, and duration. A final report summarizes all tests with an overall PASS/FAIL.

## Algorithm Comparison

| Property              | Token Bucket                        | Fixed Window                       |
|-----------------------|-------------------------------------|------------------------------------|
| Rate Model            | Continuous refill                   | Discrete counter reset             |
| Burst Handling        | Allows controlled bursts            | Allows full limit at boundary      |
| Boundary Problem      | None                                | 2x burst possible at window edge   |
| Memory per Client     | ~64 bytes                           | ~48 bytes                          |
| Complexity            | Moderate (floating-point math)      | Simple (integer counter)           |
| Time Precision        | Sub-second                          | Window-aligned                     |
| Real-World Usage      | AWS API Gateway, Stripe, Cloudflare | GitHub API, many REST APIs         |
