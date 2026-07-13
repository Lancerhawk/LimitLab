import { prisma } from '../database/prisma';
import { processLeakyBucket } from '../algorithms/leakyBucket';
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
    console.log(`[LeakyBucket DB] ${name}: ${duration}ms`);
  }
}

export class LeakyBucketRateLimiterService {
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
      this.logRequest(client.id, RequestDecision.DENY, Date.now() - startTime, 0, 0, 0, 0).catch(console.error);
      return this.formatResponse(RequestDecision.DENY, 0, 0, 0, startTime);
    }

    if (client.configuration.algorithm !== 'LEAKY_BUCKET') {
      throw new Error('Algorithm not supported by this endpoint');
    }

    const queueCapacity = client.configuration.queueCapacity ?? 10;
    const leakRate = client.configuration.leakRate ?? 1;

    const arrivalTime = new Date();
    const maxAttempts = env.MAX_OCC_ATTEMPTS;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const state = await measureQuery(`State Lookup (Attempt ${attempt + 1})`, () =>
        prisma.leakyBucketState.findUnique({
          where: { clientId: client.id }
        })
      );

      if (!state) {
        throw new Error('Leaky Bucket state not initialized');
      }

      const { decision, queueLength, lastLeakTime, retryAfterSeconds, resetTimestamp } = processLeakyBucket({
        queueCapacity,
        leakRate,
        queueLength: state.queueLength,
        lastLeakTime: state.lastLeakTime,
        requestTime: arrivalTime,
      });

      if (decision === RequestDecision.DENY) {
        this.logRequest(client.id, decision, Date.now() - startTime, queueLength, queueCapacity, leakRate, attempt).catch(console.error);
        return this.formatResponse(decision, queueCapacity - queueLength, queueLength, queueCapacity, startTime, leakRate, retryAfterSeconds, resetTimestamp);
      }

      const nextVersionTimestamp = new Date(
        Math.max(Date.now(), state.updatedAt.getTime() + 1)
      );

      const updatedCount = await measureQuery(`OCC Update (Attempt ${attempt + 1})`, () =>
        prisma.$executeRaw`
          UPDATE "leaky_bucket_states"
          SET
            "queueLength" = ${queueLength},
            "lastLeakTime" = ${lastLeakTime},
            "updatedAt" = ${nextVersionTimestamp}
          WHERE "clientId" = ${client.id}
            AND "updatedAt" = ${state.updatedAt}
        `
      );

      if (updatedCount === 1) {
        this.logRequest(client.id, decision, Date.now() - startTime, queueLength, queueCapacity, leakRate, attempt).catch(console.error);
        return this.formatResponse(decision, queueCapacity - queueLength, queueLength, queueCapacity, startTime, leakRate, retryAfterSeconds, resetTimestamp);
      }

      if (attempt < maxAttempts - 1) {
        const jitterMs = 1 + Math.random() * Math.min(10 * (attempt + 1), 50);
        await new Promise(resolve => setTimeout(resolve, jitterMs));
      }
    }

    throw new Error('RATE_LIMITER_UNAVAILABLE');
  }

  private static formatResponse(
    decision: RequestDecision,
    remainingCapacity: number,
    queueLength: number,
    capacity: number,
    startTime: number,
    leakRate?: number,
    retryAfterSeconds?: number,
    resetTimestamp?: number
  ) {
    const latency = Date.now() - startTime;
    return {
      decision,
      remainingCapacity: Math.max(0, remainingCapacity),
      queueLength,
      capacity,
      leakRate: leakRate ?? 0,
      latency,
      timestamp: new Date().toISOString(),
      ...(retryAfterSeconds !== undefined && { retryAfter: retryAfterSeconds }),
      ...(resetTimestamp !== undefined && { resetTimestamp }),
    };
  }

  private static async logRequest(
    clientId: string,
    decision: RequestDecision,
    latencyMs: number,
    queueLength: number,
    capacity: number,
    leakRate: number,
    occRetries: number
  ) {
    if (env.ENABLE_RATE_LIMIT_TIMING) {
      console.log(`[LeakyBucket Summary] Decision: ${decision}, Total Latency: ${latencyMs}ms, OCC Retries: ${occRetries}`);
    }

    try {
      await Promise.all([
        measureQuery('Request Log Insert', () =>
          prisma.requestLog.create({
            data: {
              clientId,
              requestId: randomUUID(),
              algorithm: 'LEAKY_BUCKET',
              decision,
              latencyMs,
              remainingTokens: capacity - queueLength,
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
    } catch (error) {
      console.error('[LeakyBucket DB] Failed to log request:', error);
    }
  }
}
