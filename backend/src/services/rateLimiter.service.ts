import { prisma } from '../database/prisma';
import { processTokenBucket } from '../algorithms/tokenBucket';
import { RequestDecision } from '@prisma/client';
import { randomUUID } from 'crypto';
import { env } from '../config/env';

/**
 * Wraps a database query with timing instrumentation if ENABLE_RATE_LIMIT_TIMING is true.
 */
async function measureQuery<T>(name: string, queryFn: () => Promise<T>): Promise<T> {
  if (!env.ENABLE_RATE_LIMIT_TIMING) return queryFn();
  const start = Date.now();
  try {
    return await queryFn();
  } finally {
    const duration = Date.now() - start;
    console.log(`[RateLimiter DB] ${name}: ${duration}ms`);
  }
}

export class RateLimiterService {
  static async processRequest(apiKey: string) {
    const startTime = Date.now();

    // ── Authentication & Configuration ──
    // We must load the client to check if they exist, are active, and to get their specific rate limit configuration (capacity, refillRate).
    const client = await measureQuery('Client Lookup', () => 
      prisma.client.findUnique({
        where: { apiKey },
        include: { configuration: true }
      })
    );

    if (!client) {
      throw new Error('UNAUTHORIZED');
    }

    if (!client.isActive || !client.configuration?.isEnabled) {
      this.logRequest(client.id, RequestDecision.DENY, Date.now() - startTime, 0, 0).catch(console.error);
      return this.formatResponse(RequestDecision.DENY, 0, 0, startTime);
    }

    if (client.configuration.algorithm !== 'TOKEN_BUCKET') {
      throw new Error('Algorithm not supported in current implementation');
    }

    const capacity = client.configuration.burstSize ?? 10;
    const refillRate = client.configuration.refillRate ?? 1;

    const arrivalTime = new Date();
    const maxAttempts = env.MAX_OCC_ATTEMPTS;

    // ── State-Recalculation Loop ──
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Step 1: Load the latest COMMITTED bucket state
      // We read the current state to know exactly how many tokens the client currently has and when they last refilled.
      const state = await measureQuery(`Bucket Lookup (Attempt ${attempt + 1})`, () => 
        prisma.bucketState.findUnique({
          where: { clientId: client.id }
        })
      );

      if (!state) {
        throw new Error('Bucket state not initialized');
      }

      // Step 2: Run the pure Token Bucket algorithm using the frozen arrival time
      const { decision, remainingTokens, lastRefillTime } = processTokenBucket({
        capacity,
        refillRate,
        remainingTokens: state.remainingTokens,
        lastRefillTime: state.lastRefillTime,
        requestTime: arrivalTime,
      });

      // Step 3: Zero-Write DENY Optimization
      // If there are genuinely no tokens available, return immediately.
      // No database write is needed because:
      //   - The bucket state hasn't changed (no token was consumed).
      //   - The refill calculation is time-based and will be recalculated
      //     correctly by the next request using the committed lastRefillTime.
      //   - This eliminates ALL OCC collisions for denied traffic.
      if (decision === RequestDecision.DENY) {
        this.logRequest(client.id, decision, Date.now() - startTime, remainingTokens, attempt).catch(console.error);
        return this.formatResponse(decision, remainingTokens, capacity, startTime);
      }

      // Step 4: ALLOW path → Attempt atomic OCC update
      // Generate a strictly monotonic version timestamp to prevent
      // millisecond collisions between concurrent writers.
      const nextVersionTimestamp = new Date(
        Math.max(Date.now(), state.updatedAt.getTime() + 1)
      );

      // We use $executeRaw to ensure atomicity. This only succeeds if no other request has modified this bucket state since we read it (checked via "updatedAt").
      const updatedCount = await measureQuery(`OCC Update (Attempt ${attempt + 1})`, () => 
        prisma.$executeRaw`
          UPDATE "bucket_states"
          SET
            "remainingTokens" = ${remainingTokens},
            "lastRefillTime" = ${lastRefillTime},
            "currentCapacity" = ${capacity},
            "updatedAt" = ${nextVersionTimestamp}
          WHERE "clientId" = ${client.id}
            AND "updatedAt" = ${state.updatedAt}
        `
      );

      if (updatedCount === 1) {
        // Step 5: Success — the committed state matches our calculation.
        this.logRequest(client.id, decision, Date.now() - startTime, remainingTokens, attempt).catch(console.error);
        return this.formatResponse(decision, remainingTokens, capacity, startTime);
      }

      // Step 6: OCC conflict — another request committed first.
      // Discard ALL stale calculations and loop back to Step 1 to
      // re-read the newest committed state and recalculate from scratch.
      // Add a small jittered delay to reduce contention on the next read.
      if (attempt < maxAttempts - 1) {
        const jitterMs = 1 + Math.random() * Math.min(10 * (attempt + 1), 50);
        await new Promise(resolve => setTimeout(resolve, jitterMs));
      }
    }

    // If we exhaust all attempts, the database is under extreme contention.
    // This is a critical infrastructure error, not a rate-limiting decision.
    throw new Error('RATE_LIMITER_UNAVAILABLE');
  }

  private static formatResponse(decision: RequestDecision, remainingTokens: number, capacity: number, startTime: number) {
    // Round to 2 decimal places so the frontend receives values that
    // accurately represent the committed bucket state without misleading truncation.
    return {
      decision,
      remainingTokens: Math.round(remainingTokens * 100) / 100,
      capacity,
      latencyMs: Date.now() - startTime,
      timestamp: new Date()
    };
  }

  private static async logRequest(clientId: string, decision: RequestDecision, latencyMs: number, remainingTokens: number, occRetries: number) {
    if (env.ENABLE_RATE_LIMIT_TIMING) {
      console.log(`[RateLimiter Summary] Decision: ${decision}, Total Latency: ${latencyMs}ms, OCC Retries: ${occRetries}`);
    }

    // Fire and forget logging operations in parallel.
    // We log each request for analytics/debugging, and update aggregate statistics for the client dashboard.
    // They are independent and can safely execute concurrently.
    await Promise.all([
      measureQuery('Request Log Insert', () =>
        prisma.requestLog.create({
          data: {
            clientId,
            requestId: randomUUID(),
            algorithm: 'TOKEN_BUCKET',
            decision,
            latencyMs,
            remainingTokens
          }
        })
      ),
      measureQuery('Statistics Update', () => {
        if (decision === 'ALLOW') {
          return prisma.clientStatistics.updateMany({
            where: { clientId },
            data: {
              totalRequests: { increment: 1 },
              allowedRequests: { increment: 1 },
              lastRequestTime: new Date(),
            }
          });
        } else {
          return prisma.clientStatistics.updateMany({
            where: { clientId },
            data: {
              totalRequests: { increment: 1 },
              deniedRequests: { increment: 1 },
              lastRequestTime: new Date(),
            }
          });
        }
      })
    ]);
  }
}
