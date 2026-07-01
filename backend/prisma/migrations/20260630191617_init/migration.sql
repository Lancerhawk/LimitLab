CREATE TYPE "RateLimitAlgorithm" AS ENUM ('TOKEN_BUCKET', 'FIXED_WINDOW', 'SLIDING_WINDOW');

CREATE TYPE "RequestDecision" AS ENUM ('ALLOW', 'DENY');

CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rate_limit_configurations" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "algorithm" "RateLimitAlgorithm" NOT NULL,
    "requestsPerSecond" INTEGER NOT NULL DEFAULT 10,
    "burstSize" INTEGER,
    "refillRate" DOUBLE PRECISION,
    "windowDurationMs" INTEGER,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_configurations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bucket_states" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "remainingTokens" DOUBLE PRECISION NOT NULL,
    "lastRefillTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentCapacity" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bucket_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "window_states" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "currentWindow" BIGINT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "resetTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "window_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_statistics" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "totalRequests" BIGINT NOT NULL DEFAULT 0,
    "allowedRequests" BIGINT NOT NULL DEFAULT 0,
    "deniedRequests" BIGINT NOT NULL DEFAULT 0,
    "averageLatencyMs" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "lastRequestTime" TIMESTAMP(3),
    "currentRps" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_statistics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "request_logs" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "algorithm" "RateLimitAlgorithm" NOT NULL,
    "decision" "RequestDecision" NOT NULL,
    "latencyMs" DOUBLE PRECISION NOT NULL,
    "remainingTokens" DOUBLE PRECISION,
    "retryAfterMs" INTEGER,

    CONSTRAINT "request_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clients_apiKey_key" ON "clients"("apiKey");

CREATE UNIQUE INDEX "rate_limit_configurations_clientId_key" ON "rate_limit_configurations"("clientId");

CREATE UNIQUE INDEX "bucket_states_clientId_key" ON "bucket_states"("clientId");

CREATE UNIQUE INDEX "window_states_clientId_key" ON "window_states"("clientId");

CREATE UNIQUE INDEX "client_statistics_clientId_key" ON "client_statistics"("clientId");

CREATE UNIQUE INDEX "request_logs_requestId_key" ON "request_logs"("requestId");

CREATE INDEX "request_logs_clientId_timestamp_idx" ON "request_logs"("clientId", "timestamp");

ALTER TABLE "rate_limit_configurations" ADD CONSTRAINT "rate_limit_configurations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bucket_states" ADD CONSTRAINT "bucket_states_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "window_states" ADD CONSTRAINT "window_states_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_statistics" ADD CONSTRAINT "client_statistics_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "request_logs" ADD CONSTRAINT "request_logs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
