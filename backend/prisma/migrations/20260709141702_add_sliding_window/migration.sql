-- CreateTable
CREATE TABLE "sliding_window_states" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "currentWindow" BIGINT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "previousWindow" BIGINT NOT NULL,
    "previousCount" INTEGER NOT NULL DEFAULT 0,
    "resetTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sliding_window_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sliding_window_states_clientId_key" ON "sliding_window_states"("clientId");

-- AddForeignKey
ALTER TABLE "sliding_window_states" ADD CONSTRAINT "sliding_window_states_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
