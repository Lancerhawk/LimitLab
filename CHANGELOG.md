# Changelog

All notable changes to LimitLab will be documented in this file.

## [1.1.0] - 2026-07-23
### Added
- Redesigned the Dashboard into a comprehensive, developer-focused Home page (`/homepage`).
- Built a 7-section layout on the new Home page to explain algorithms, features, sandbox limits, and provide a clear starting point.
- Rebuilt the Sidebar navigation from scratch, providing smoother mobile and desktop transitions (removed generic collapse strip in favor of a clean slide-in overlay).
- Integrated the LimitLab logo properly into the Sidebar and mobile Top Navbar.

### Changed
- Re-routed the base path `/dashboard` to `/homepage` and removed obsolete SaaS dashboard widgets.

### Fixed
- Fixed algorithm badge text overflow wrapping on the Clients page.
- Fixed responsive squishing issue on the Simulator Timeline legend on smaller screens.

## [1.0.0] - 2026-07-13
### Added
- Official v1.0.0 Release!
- Dynamic Configuration Injection: Downloaded test scripts (Node, Python, Bash) now automatically detect and inject the user's specific database limits and algorithm wait-times into the load test templates.
- Advanced Sandbox Targeting: Downloaded scripts correctly differentiate between Targeted scripts (using real API keys with custom limits) and Advanced Simulation scripts (falling back to the 10req/60s Sandbox limits).
- Complete Memory Cache Invalidation: Real-time eviction of LRU cache variables for `InMemory` rate limiters across all 5 algorithms to guarantee instant synchronization with UI updates.

### Fixed
- Fixed strict algorithm validation logic: `InMemory` APIs now instantly reject requests (`HTTP 500 Algorithm Mismatch`) when accessed with mismatched API keys, preventing cross-algorithm limit pollution.
- Re-architected API CORS routing: Removed overly strict global CORS blocks. Public `/api/v1/rate-limit/` endpoints are now fully open (`*`) to facilitate external application integration, while Dashboard APIs remain strictly guarded.
- Resolved "Probe Leak" bug in `.ts` testing scripts where dynamic backend probes consumed tokens from the test capacity.
- Updated all test scripts to gracefully halt and display readable warnings upon receiving 500 Algorithm Mismatch errors.

## [0.9.0] - 2026-07-10
### Added
- Implemented Leaky Bucket rate limiting algorithm
- Added PostgreSQL-backed Leaky Bucket implementation with persistent queue state
- Built in-memory Leaky Bucket implementation using bounded LRU cache
- Implemented constant leak-rate processing with automatic queue draining
- Added queue capacity management with allow/deny decision logic
- Integrated Leaky Bucket into the existing client configuration workflow
- Extended algorithm selection to support all five rate limiting algorithms
- Added dedicated database and in-memory Leaky Bucket API endpoints
- Integrated Leaky Bucket into the existing Playground
- Extended the Simulation page with queue visualization, leak animation, and algorithm comparison
- Added queue length, remaining capacity, leak rate, Retry-After, and reset time calculations
- Implemented standard rate limiting response headers
- Added comprehensive TypeScript load testing covering burst traffic, queue draining, refill behavior, and capacity validation
- Added downloadable JavaScript load testing script for external developer testing
- Added backend validation, error handling, and consistent response formatting
- Documented Leaky Bucket architecture, traffic shaping, complexity, advantages, disadvantages, and real-world use cases
- Added comparisons with Token Bucket, Fixed Window, Sliding Window Counter, and Sliding Log
- Preserved compatibility with existing algorithms, Playground, Simulation, client management, and testing infrastructure
- Verified algorithm behavior through automated load testing

## [0.8.0] - 2026-07-10
### Added
- Implemented authentic Sliding Log rate limiting algorithm
- Added PostgreSQL-backed Sliding Log implementation with persistent timestamp storage
- Built high-performance in-memory Sliding Log implementation using bounded LRU cache
- Implemented timestamp-based request tracking with automatic expiration of stale entries
- Added efficient sliding window cleanup for both database and in-memory implementations
- Integrated Sliding Log into the existing client configuration workflow
- Extended algorithm selection to support Token Bucket, Fixed Window, Sliding Window Counter, and Sliding Log
- Added dedicated Sliding Log API endpoints for database-backed and in-memory implementations
- Integrated Sliding Log into the existing Playground without altering the testing experience
- Extended the Simulation page to visualize active request timestamps and automatic expiration
- Added timeline visualization demonstrating Sliding Log behavior in real time
- Implemented standard HTTP rate-limiting headers including Retry-After and X-RateLimit-Reset
- Created comprehensive TypeScript load-testing suite covering burst traffic, expiration behavior, and sliding window validation
- Added downloadable JavaScript load-testing script for external developer testing
- Implemented backend validation, robust error handling, and consistent response formatting
- Added comprehensive documentation explaining Sliding Log architecture, advantages, disadvantages, complexity, and real-world use cases
- Compared Sliding Log against Token Bucket, Fixed Window, and Sliding Window Counter within project documentation
- Preserved compatibility with all existing algorithms, Playground, Simulation, client management, and testing infrastructure
- Verified mathematical correctness, timestamp expiration, concurrency safety, and expected behavior through comprehensive automated load testing

## [0.7.0] - 2026-07-09
### Added
- Implemented a complete, authentic PostgreSQL-backed Sliding Window Counter algorithm.
- Designed `SlidingWindowState` Prisma schema extensions to safely track `currentWindow`, `requestCount`, `previousWindow`, and `previousCount`.
- Engineered real-time window overlap mathematics (`elapsed / windowDurationMs`) to smoothly blend previous and current request weights.
- Added a dedicated high-performance in-memory Sliding Window algorithm endpoint for load testing.
- Created standalone dynamic script generation variants (Basic IP-based Sandbox vs Advanced Multi-Client Simulation) across Node.js, Python, and Bash.
- Refactored the UI to use a dedicated Download Scripts Modal tailored with explicit algorithm-specific educational explanations.
- Designed live dynamic UI visualizers in the dashboard specifically tailored to calculate and render Sliding Window token approximations in real-time.
- Developed an authentic `slidingWindowLoadTest.ts` framework simulating heavy simultaneous traffic bursts overlapping window boundaries.
- Refactored the Traffic Simulator engine to flawlessly render continuous visual boundaries and request weights for Sliding Window limits.


## [0.6.0] - 2026-07-04
### Added
- Engineered a pure client-side deterministic simulation engine (Phase 6) to model and compare Token Bucket and Fixed Window algorithms.
- Created an interactive timeline for visualizing traffic events, allowing manual placement, dragging, and deletion of individual requests.
- Developed real-time visualizers including a Token Bucket capacity meter and a Fixed Window countdown ring.
- Integrated robust Recharts graphs for throughput, token levels, and acceptance rates with dynamic tooltips.
- Added a dedicated "Comparison Mode" to evaluate both algorithms side-by-side using identical synchronized traffic datasets.
- Implemented comprehensive traffic generators simulating constant load, bursts, and randomized realistic API traffic patterns.
- Resolved extreme React rendering bottlenecks under high traffic load (~10,000 requests) using visual DOM clustering and 30fps RAF batching.
- Decoupled high-frequency lightweight state (playhead, bucket fill) from low-frequency heavy state (Recharts arrays, timeline DOM nodes).
- Optimized statistics computation from multiple nested iterations into a single O(n) array pass, removing large intermediate structures.
- Isolated React components using strict memoization to eliminate redundant render cycles during 60fps simulation playback.
- Fixed a concurrency edge case in comparison mode where finished simulations erroneously wiped state when receiving identical traffic inputs.

## [0.5.0] - 2026-07-03
### Added
- Designed and implemented an authentic PostgreSQL-backed Fixed Window rate limiter
- Created robust `windowState` Prisma schema extensions to track `currentWindow`, `requestCount`, and `resetTime`
- Applied Optimistic Concurrency Control (OCC) via atomic SQL updates to ensure strict concurrency safety for Fixed Window states
- Engineered robust state-recalculation retry loops to completely prevent request count over-increments during race conditions
- Implemented absolute system clock boundary calculations to ensure globally synchronized and exact window resets
- Added zero-write optimizations for Fixed Window requests that are denied due to an exhausted capacity
- Built a dedicated high-performance in-memory Fixed Window algorithm utilizing LRU caching for isolated load testing
- Integrated standard HTTP rate-limiting headers specifically for Fixed Window (e.g., `X-RateLimit-Reset` yielding precise Unix timestamps)
- Re-architected backend test routing to securely segregate in-memory Token Bucket and Fixed Window endpoints via `req.ip`
- Created dynamic UI visualizers in the dashboard specifically tailored to Fixed Window's absolute time horizon semantics
- Resolved a stale frontend state issue where long-lived browser sessions incorrectly calculated remaining capacity boundaries
- Developed an authentic `fixedWindowLoadTest.ts` framework simulating sustained single-client capacity limits across multiple clock epochs
- Added standalone downloadable `Node.js`, `Python`, and `Bash` test scripts in the UI for both algorithms
- Architected dynamic script generation to inject algorithm-specific wait times (12s for Token Bucket refills, 61s for Fixed Window resets)

## [0.4.0] - 2026-07-01
### Added
- Implemented a production-grade PostgreSQL-backed Token Bucket rate limiter with continuous fractional refill calculations
- Added Optimistic Concurrency Control (OCC) using atomic SQL updates to safely handle concurrent requests
- Introduced state-recalculation retry loop to eliminate stale bucket calculations during write conflicts
- Implemented zero-write optimization for denied requests to avoid unnecessary database writes
- Added monotonic version timestamps for deterministic OCC conflict detection
- Improved concurrency handling with configurable jittered retry strategy
- Captured immutable request arrival timestamps for mathematically consistent token calculations
- Preserved fractional token precision while exposing rounded values to API consumers
- Added configurable MAX_OCC_ATTEMPTS and latency instrumentation through environment configuration
- Instrumented database operations with optional per-query timing and request performance metrics
- Parallelized asynchronous request logging and statistics updates for improved throughput
- Added production-grade request summaries including latency and OCC retry metrics
- Implemented backend validation for playground request limits and delay boundaries
- Built a dedicated in-memory Token Bucket implementation for high-performance rate limiting
- Reused the same Token Bucket algorithm across both database-backed and in-memory storage backends
- Added automatic bucket creation and idle bucket expiration for the in-memory implementation
- Replaced unbounded bucket storage with a bounded LRU cache to prevent memory exhaustion attacks
- Added standard HTTP rate-limiting headers including Retry-After and X-RateLimit-Reset
- Implemented precise retry timing calculations for denied requests based on refill rate
- Created a dedicated in-memory rate-limiting endpoint for production-style load testing
- Developed a comprehensive TypeScript load-testing framework covering simultaneous, sequential, burst, and sustained traffic scenarios
- Added automated validation for expected allow/deny behavior across multiple Token Bucket configurations
- Improved documentation explaining PostgreSQL-backed versus in-memory Token Bucket architectures
- Added extensive inline documentation describing concurrency model, algorithm flow, and architectural decisions
- Hardened the implementation against race conditions, excessive memory growth, and production edge cases
- Verified mathematical correctness, concurrency safety, and production behavior through comprehensive load testing

## [0.3.0] - 2026-07-01
### Added
- Scaffolded robust React/Vite/TypeScript frontend structure with Tailwind CSS.
- Established global routing architecture mapping out Dashboard, Clients, Simulator, Comparison, Analytics, and Settings interfaces.
- Implemented responsive `AppLayout` featuring a fully collapsible side navigation and mobile-optimized top bar.
- Developed highly reusable, accessible UI primitives including custom `Button`, `Card`, `Badge`, and `Input` components.
- Designed premium data visualization placeholders using custom section wrappers with subtle gradients and pixel-perfect padding.
- Integrated Lucide icons for intuitive navigation and empty-state messaging.

### Changed
- Refined component structures to strictly separate layout logic from presentation, ensuring high scalability for future algorithmic integrations.
- Purged unused dependencies, legacy imports, and consolidated Tailwind class merging logic.

## [0.2.1] - 2026-07-01
### Changed
- Replaced the static image with a dynamic, animated GitHub typing SVG to indicate the project is under construction.

## [0.2.0] - 2026-07-01
### Added
- Implemented the complete relational database architecture for LimitLab using Prisma ORM.
- Defined models for `Client`, `RateLimitConfiguration`, `BucketState`, `WindowState`, `ClientStatistics`, and `RequestLog`.
- Added Enums for `RateLimitAlgorithm` and `RequestDecision`.
- Configured Supabase connection string handling for PgBouncer and Direct connections.
- Generated Prisma client and ran initial migration.

## [0.1.0] - 2026-06-30
### Added
- Initialized the foundational monorepo structure for LimitLab, establishing both the backend API and the frontend React application.
- Initialized Node.js/Express server with TypeScript, Pino logging, CORS, Helmet, and Morgan.
- Set up Prisma ORM initialization and environment validation via Zod.
- Scaffolded a scalable backend directory structure (controllers, routes, services, algorithms, socket).
- Implemented basic `/health` check endpoint.
- Initialized React application with Vite, TypeScript, and Tailwind CSS v4.
- Set up React Router and established the `MainLayout` and `HomePage`.
- Configured ESLint and Prettier across frontend and backend for consistency.
- Created root `.gitignore`, `README.md`, and `LICENSE`.
