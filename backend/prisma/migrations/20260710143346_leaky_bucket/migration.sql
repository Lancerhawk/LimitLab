-- AlterEnum
ALTER TYPE "RateLimitAlgorithm" ADD VALUE 'LEAKY_BUCKET';

-- AlterTable
ALTER TABLE "rate_limit_configurations" ADD COLUMN     "leakRate" DOUBLE PRECISION,
ADD COLUMN     "queueCapacity" INTEGER;

-- CreateTable
CREATE TABLE "leaky_bucket_states" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "queueLength" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastLeakTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaky_bucket_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leaky_bucket_states_clientId_key" ON "leaky_bucket_states"("clientId");

-- AddForeignKey
ALTER TABLE "leaky_bucket_states" ADD CONSTRAINT "leaky_bucket_states_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
