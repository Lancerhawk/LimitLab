<p align="center">
  <img src="frontend/public/logo.png" alt="LimitLab Logo" width="120" />
</p>

<h1 align="center">LimitLab</h1>

<h4 align="center">An Interactive API Rate Limiting Sandbox</h4>

<p align="center">
  <img src="https://img.shields.io/badge/FRONTEND-blueviolet?style=flat-square" alt="Frontend" />
  <img src="https://img.shields.io/badge/V1.0.0-blue?style=flat-square" alt="V1.0.0" />
  <img src="https://img.shields.io/badge/BACKEND-green?style=flat-square" alt="Backend" />
  <img src="https://img.shields.io/badge/V1.0.0-brightgreen?style=flat-square" alt="V1.0.0" />
  <img src="https://img.shields.io/badge/PRISMA%20%26%20POSTGRESQL-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma & PostgreSQL" />
  <img src="https://img.shields.io/badge/TYPESCRIPT-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
</p>

<p align="center">
  <em>A high-performance, real-time sandbox for visualizing, simulating, and load-testing five fully-functional rate-limiting algorithms with dual In-Memory and PostgreSQL backends.</em>
</p>

---

## Core Capabilities

| | |
|---|---|
| **Zero-Latency Sandbox** | Test rate limits instantly with in-memory LRU caches that dynamically sync with your configurations. No external dependencies needed to start experimenting. |
| **Five Algorithm Playground** | Deep-dive into Token Bucket, Fixed Window, Sliding Window Counter, Sliding Log, and Leaky Bucket with real-time UI synchronization and per-client configurations. |
| **Visual Simulation Engine** | A deterministic, pure client-side React simulation engine with drag-and-drop timelines, live request graphs, playback speed controls, and side-by-side comparison mode. |
| **Dynamic Script Generation** | Download auto-generated load-testing scripts in Node.js, Python, and Bash that securely embed your custom DB configurations and timing constraints. |
| **Dual Architecture** | Every algorithm ships with both an In-Memory (LRU cache) implementation and a PostgreSQL-backed implementation featuring Optimistic Concurrency Control. |
| **Open Public API** | Fully open CORS sandbox endpoints designed explicitly for external benchmarking, with hard rate ceilings (500 req/s burst, 3000 req/15min sustained). |

---

## Algorithms

### 1. Token Bucket
A steady stream of tokens is added to a bucket at a constant rate. Requests consume tokens. If the bucket is empty, the request is denied. Ideal for APIs that need a steady baseline but want to allow brief bursts of traffic.

```mermaid
flowchart LR
    Start([Incoming Request]) --> Check{Are there tokens<br>in the bucket?}
    Check -->|Yes| Consume[Consume 1 Token] --> Allow([ALLOW])
    Check -->|No| Deny([DENY])
    
    Refill((Constant Rate<br>Refill)) -->|Adds tokens| Check
```

### 2. Fixed Window
Time is divided into absolute intervals. Requests are counted within that interval. Easy to implement but suffers from edge spikes where a user can send double their limit by spanning across a window boundary.

```mermaid
flowchart TD
    Start([Incoming Request]) --> GetTime[Get Current Absolute Window<br>e.g. 12:05:00]
    GetTime --> Check{Is Request Count<br>< Limit?}
    Check -->|Yes| Increment[Increment Counter] --> Allow([ALLOW])
    Check -->|No| Deny([DENY])
    
    Timer((Clock Tick)) -->|12:06:00| Reset[Reset Counter to 0]
```

### 3. Sliding Window Counter
A hybrid approach that tracks the current fixed window and the previous fixed window, calculating a weighted average based on how much time has passed in the current window. Smooths out edge spikes without the memory overhead of a log.

```mermaid
flowchart LR
    Start([Incoming Request]) --> Calc["Calculate Weighted Count:<br>Prev_Count * (1 - % time_passed) + Curr_Count"]
    Calc --> Check{Is Weighted Count<br>< Limit?}
    Check -->|Yes| Increment[Increment Curr_Count] --> Allow([ALLOW])
    Check -->|No| Deny([DENY])
```

### 4. Sliding Log
Tracks the exact timestamp of every single request in a rolling timeframe. The most accurate algorithm possible, but suffers from high memory consumption and processing overhead as every timestamp must be stored and evaluated.

```mermaid
flowchart TD
    Start([Incoming Request]) --> Prune[Delete all logs older than<br>Current Time - Window]
    Prune --> Count[Count remaining logs]
    Count --> Check{Is Count < Limit?}
    Check -->|Yes| Log[Store Current Timestamp] --> Allow([ALLOW])
    Check -->|No| Deny([DENY])
```

### 5. Leaky Bucket
Incoming requests are placed into a queue. The queue leaks (processes requests) at a strictly constant rate. If the queue is full, new requests are dropped. Ideal for strict traffic shaping and protecting downstream services from sudden load spikes.

```mermaid
flowchart LR
    Start([Incoming Request]) --> Drain[Calculate how much queue<br>drained since last request]
    Drain --> Check{Is Queue Length<br>< Capacity?}
    Check -->|Yes| Enqueue[Add Request to Queue] --> Allow([ALLOW])
    Check -->|No| Drop[Drop Request] --> Deny([DENY])
```

---

## System Architecture

```mermaid
flowchart LR
    Client((Client App /<br>Test Script)) -->|HTTP POST| Gateway[Express Router<br>/api/v1/rate-limit]
    
    Gateway -->|Global Sandbox Limits| Middleware(Rate Limit Middleware<br>Max 500 req/s)
    Middleware --> Controller[RateLimit Controller]
    
    Controller -->|Read x-client-id| Auth{Is Real Client?}
    
    Auth -->|Yes| DB[(PostgreSQL)]
    Auth -->|No| Fallback[Default Sandbox Limits<br>10 req / 60s]
    
    DB -.->|Fetch Config| Svc[RateLimiter Services]
    Fallback -.-> Svc
    
    Svc -->|In-Memory Endpoint| MemCache[(LRU Memory Cache)]
    Svc -->|Database Endpoint| DB
    
    MemCache --> Result[Calculate Decision<br>ALLOW / DENY]
    DB --> Result
    
    Result -->|X-RateLimit Headers| Client
```

---

## Database Schema

```mermaid
erDiagram
    Client {
        String id PK
        String name
        String apiKey UK
        String description
        Boolean isActive
        DateTime createdAt
        DateTime updatedAt
    }

    RateLimitConfiguration {
        String id PK
        String clientId FK
        RateLimitAlgorithm algorithm
        Int requestsPerSecond
        Int burstSize
        Float refillRate
        Int windowDurationMs
        Int queueCapacity
        Float leakRate
        Boolean isEnabled
        DateTime createdAt
        DateTime updatedAt
    }

    BucketState {
        String id PK
        String clientId FK
        Float remainingTokens
        DateTime lastRefillTime
        Float currentCapacity
        DateTime createdAt
        DateTime updatedAt
    }

    WindowState {
        String id PK
        String clientId FK
        BigInt currentWindow
        Int requestCount
        DateTime resetTime
        DateTime createdAt
        DateTime updatedAt
    }

    SlidingWindowState {
        String id PK
        String clientId FK
        BigInt currentWindow
        Int requestCount
        BigInt previousWindow
        Int previousCount
        DateTime resetTime
        DateTime createdAt
        DateTime updatedAt
    }

    LeakyBucketState {
        String id PK
        String clientId FK
        Float queueLength
        DateTime lastLeakTime
        DateTime createdAt
        DateTime updatedAt
    }

    ClientStatistics {
        String id PK
        String clientId FK
        BigInt totalRequests
        BigInt allowedRequests
        BigInt deniedRequests
        Float averageLatencyMs
        DateTime lastRequestTime
        Float currentRps
        DateTime createdAt
        DateTime updatedAt
    }

    RequestLog {
        String id PK
        String clientId FK
        String requestId UK
        DateTime timestamp
        RateLimitAlgorithm algorithm
        RequestDecision decision
        Float latencyMs
        Float remainingTokens
        Int retryAfterMs
    }

    SlidingLogRequest {
        String id PK
        String clientId FK
        BigInt requestTimestamp
        DateTime createdAt
    }

    Client ||--o| RateLimitConfiguration : "has configuration"
    Client ||--o| BucketState : "has token bucket state"
    Client ||--o| WindowState : "has fixed window state"
    Client ||--o| SlidingWindowState : "has sliding window state"
    Client ||--o| LeakyBucketState : "has leaky bucket state"
    Client ||--o| ClientStatistics : "has statistics"
    Client ||--o{ RequestLog : "has logs"
    Client ||--o{ SlidingLogRequest : "has sliding log requests"
```

---

## Project Structure

```text
LimitLab/
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable UI components (Cards, Badges, Charts)
│   │   │   ├── ui/             # shadcn/ui generic components
│   │   │   └── dashboard/      # Custom dashboard visualizations
│   │   ├── pages/              # Main routing views
│   │   │   ├── ClientDetailsPage.tsx  # Interactive sandbox, script generation, real-time UI sync
│   │   │   ├── DashboardPage.tsx      # Global statistics overview
│   │   │   └── SimulatorPage.tsx      # Visual drag-and-drop deterministic simulation
│   │   ├── simulation/         # Pure client-side simulation engine
│   │   │   ├── simulationEngine.ts    # Core deterministic engine
│   │   │   ├── algorithms/            # Per-algorithm simulator implementations
│   │   │   ├── hooks/                 # React hooks for engine integration
│   │   │   └── components/            # Simulator-specific UI components
│   │   ├── lib/
│   │   │   └── utils.ts        # Tailwind merge & utility functions
│   │   ├── App.tsx             # React Router configuration
│   │   ├── main.tsx            # React DOM entry point
│   │   └── index.css           # Global Tailwind v4 styles
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── src/
│   │   ├── config/             # Environment and Logger setup
│   │   ├── controllers/        # HTTP Handlers
│   │   ├── middleware/         # Admin authentication middleware
│   │   ├── routes/             # Express Routers
│   │   └── services/           # Core Business Logic & Algorithm Implementations
│   ├── prisma/
│   │   └── schema.prisma       # PostgreSQL Database Models
│   ├── tests/                  # TypeScript Load Testing Suite
│   ├── package.json
│   └── tsconfig.json
│
├── .github/
│   └── workflows/
│       └── ci.yml              # Automated lint & build checks
│
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js (v20+)
- PostgreSQL Database (Local or Supabase)

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env          # Set DATABASE_URL and DIRECT_URL
npx prisma generate
npx prisma db push
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env          # Set VITE_API_URL=http://localhost:3001/api/v1
npm run dev
```

---

## API Endpoint Security

| Endpoint Group | CORS | Rate Limit | Auth |
|---|---|---|---|
| `/health` | Open | None | None |
| `/api/v1/clients` | Strict (Vercel origin only) | 100 req / 15 min | Admin Key for create/delete |
| `/api/v1/stats/dashboard` | Strict (Vercel origin only) | 100 req / 15 min | None |
| `/api/v1/rate-limit/*` | Open (sandbox) | 500 req/s burst + 3000 req/15min sustained | None |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, Recharts, Framer Motion |
| Backend | Node.js, Express.js, TypeScript |
| ORM | Prisma 6 |
| Database | PostgreSQL (Supabase) |
| Deployment | Vercel (Frontend), AWS EC2 + Nginx + PM2 (Backend) |
| CI/CD | GitHub Actions |

---

<p align="center"><em>Built for API Engineers and Architects.</em></p>
