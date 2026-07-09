import { prisma } from '../database/prisma';
import { processSlidingWindow } from '../algorithms/slidingWindow';
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
    console.log(`[SlidingWindow DB] ${name}: ${duration}ms`);
  }
}

export class SlidingWindowRateLimiterService {
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
      return this.formatResponse(RequestDecision.DENY, 0, 0, 0, 0, startTime);
    }

    if (client.configuration.algorithm !== 'SLIDING_WINDOW') {
      throw new Error('Algorithm mismatch: expected SLIDING_WINDOW');
    }

    const windowDurationMs = client.configuration.windowDurationMs ?? 60000;
    const requestLimit = client.configuration.requestsPerSecond ?? 10;

    const arrivalTime = new Date();
    const maxAttempts = env.MAX_OCC_ATTEMPTS;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const state = await measureQuery(`SlidingWindow Lookup (Attempt ${attempt + 1})`, () =>
        prisma.slidingWindowState.findUnique({
          where: { clientId: client.id }
        })
      );

      if (!state) {
        throw new Error('Sliding window state not initialized');
      }

      const result = processSlidingWindow({
        windowDurationMs,
        requestLimit,
        currentWindowCount: state.requestCount,
        currentWindowStart: Number(state.currentWindow),
        previousWindowCount: state.previousCount,
        previousWindowStart: Number(state.previousWindow),
        requestTime: arrivalTime,
      });

      if (result.decision === RequestDecision.DENY) {
        this.logRequest(client.id, result.decision, Date.now() - startTime, result.effectiveCount, attempt).catch(console.error);
        return this.formatResponse(
          result.decision, result.effectiveCount, requestLimit,
          result.overlapPercentage, result.previousWindowCount, startTime,
          result.retryAfterSeconds, result.resetTimestamp
        );
      }

      const nextVersionTimestamp = new Date(
        Math.max(Date.now(), state.updatedAt.getTime() + 1)
      );

      const updatedCount = await measureQuery(`OCC Update (Attempt ${attempt + 1})`, () =>
        prisma.$executeRaw`
          UPDATE "sliding_window_states"
          SET
            "currentWindow" = ${BigInt(result.currentWindowStart)},
            "requestCount" = ${result.currentWindowCount},
            "previousWindow" = ${BigInt(result.previousWindowStart)},
            "previousCount" = ${result.previousWindowCount},
            "resetTime" = ${new Date((Math.floor(arrivalTime.getTime() / windowDurationMs) + 1) * windowDurationMs)},
            "updatedAt" = ${nextVersionTimestamp}
          WHERE "clientId" = ${client.id}
            AND "updatedAt" = ${state.updatedAt}
        `
      );

      if (updatedCount === 1) {
        this.logRequest(client.id, result.decision, Date.now() - startTime, result.effectiveCount, attempt).catch(console.error);
        return this.formatResponse(
          result.decision, result.effectiveCount, requestLimit,
          result.overlapPercentage, result.previousWindowCount, startTime,
          result.retryAfterSeconds, result.resetTimestamp
        );
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
    effectiveCount: number,
    requestLimit: number,
    overlapPercentage: number,
    previousWindowCount: number,
    startTime: number,
    retryAfterSeconds?: number,
    resetTimestamp?: number
  ) {
    return {
      decision,
      remainingTokens: Math.max(0, Math.floor(requestLimit - effectiveCount)),
      capacity: requestLimit,
      effectiveCount: Math.round(effectiveCount * 100) / 100,
      overlapPercentage: Math.round(overlapPercentage * 10000) / 100,
      previousWindowCount,
      latencyMs: Date.now() - startTime,
      timestamp: new Date(),
      ...(retryAfterSeconds !== undefined && { retryAfterSeconds }),
      ...(resetTimestamp !== undefined && { resetTimestamp })
    };
  }

  private static async logRequest(clientId: string, decision: RequestDecision, latencyMs: number, effectiveCount: number, occRetries: number) {
    if (env.ENABLE_RATE_LIMIT_TIMING) {
      console.log(`[SlidingWindow Summary] Decision: ${decision}, Total Latency: ${latencyMs}ms, OCC Retries: ${occRetries}`);
    }

    await Promise.all([
      measureQuery('Request Log Insert', () =>
        prisma.requestLog.create({
          data: {
            clientId,
            requestId: randomUUID(),
            algorithm: 'SLIDING_WINDOW',
            decision,
            latencyMs,
            remainingTokens: effectiveCount
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
