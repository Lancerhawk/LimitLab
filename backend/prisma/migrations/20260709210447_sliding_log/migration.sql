-- AlterEnum
ALTER TYPE "RateLimitAlgorithm" ADD VALUE 'SLIDING_LOG';

-- CreateTable
CREATE TABLE "sliding_log_requests" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestTimestamp" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sliding_log_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sliding_log_requests_clientId_requestTimestamp_idx" ON "sliding_log_requests"("clientId", "requestTimestamp");

-- AddForeignKey
ALTER TABLE "sliding_log_requests" ADD CONSTRAINT "sliding_log_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
