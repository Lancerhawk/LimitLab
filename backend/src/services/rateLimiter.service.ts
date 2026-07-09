import { prisma } from '../database/prisma';
import { processTokenBucket } from '../algorithms/tokenBucket';
import { RequestDecision } from '@prisma/client';
import { randomUUID } from 'crypto';
import { env } from '../config/env';

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

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const state = await measureQuery(`Bucket Lookup (Attempt ${attempt + 1})`, () =>
        prisma.bucketState.findUnique({
          where: { clientId: client.id }
        })
      );

      if (!state) {
        throw new Error('Bucket state not initialized');
      }

      const { decision, remainingTokens, lastRefillTime } = processTokenBucket({
        capacity,
        refillRate,
        remainingTokens: state.remainingTokens,
        lastRefillTime: state.lastRefillTime,
        requestTime: arrivalTime,
      });

      if (decision === RequestDecision.DENY) {
        this.logRequest(client.id, decision, Date.now() - startTime, remainingTokens, attempt).catch(console.error);
        return this.formatResponse(decision, remainingTokens, capacity, startTime);
      }

      const nextVersionTimestamp = new Date(
        Math.max(Date.now(), state.updatedAt.getTime() + 1)
      );

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
        this.logRequest(client.id, decision, Date.now() - startTime, remainingTokens, attempt).catch(console.error);
        return this.formatResponse(decision, remainingTokens, capacity, startTime);
      }

      if (attempt < maxAttempts - 1) {
        const jitterMs = 1 + Math.random() * Math.min(10 * (attempt + 1), 50);
        await new Promise(resolve => setTimeout(resolve, jitterMs));
      }
    }

    throw new Error('RATE_LIMITER_UNAVAILABLE');
  }

  private static formatResponse(decision: RequestDecision, remainingTokens: number, capacity: number, startTime: number) {

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
