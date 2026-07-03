import { prisma } from '../database/prisma';
import { processFixedWindow } from '../algorithms/fixedWindow';
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
    console.log(`[FixedWindow DB] ${name}: ${duration}ms`);
  }
}

export class FixedWindowRateLimiterService {
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

    if (client.configuration.algorithm !== 'FIXED_WINDOW') {
      throw new Error('Algorithm mismatch: expected FIXED_WINDOW');
    }

    const windowDurationMs = client.configuration.windowDurationMs ?? 60000;
    const requestLimit = client.configuration.requestsPerSecond ?? 10;

    const arrivalTime = new Date();
    const maxAttempts = env.MAX_OCC_ATTEMPTS;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const state = await measureQuery(`Window Lookup (Attempt ${attempt + 1})`, () =>
        prisma.windowState.findUnique({
          where: { clientId: client.id }
        })
      );

      if (!state) {
        throw new Error('Window state not initialized');
      }

      const { decision, requestCount, windowStart, retryAfterSeconds, resetTimestamp } = processFixedWindow({
        windowDurationMs,
        requestLimit,
        requestCount: state.requestCount,
        windowStart: Number(state.currentWindow),
        requestTime: arrivalTime,
      });

      if (decision === RequestDecision.DENY) {
        this.logRequest(client.id, decision, Date.now() - startTime, requestCount, attempt).catch(console.error);
        return this.formatResponse(decision, requestCount, requestLimit, startTime, retryAfterSeconds, resetTimestamp);
      }

      const nextVersionTimestamp = new Date(
        Math.max(Date.now(), state.updatedAt.getTime() + 1)
      );

      const updatedCount = await measureQuery(`OCC Update (Attempt ${attempt + 1})`, () =>
        prisma.$executeRaw`
          UPDATE "window_states"
          SET
            "currentWindow" = ${BigInt(windowStart)},
            "requestCount" = ${requestCount},
            "resetTime" = ${new Date((Math.floor(arrivalTime.getTime() / windowDurationMs) + 1) * windowDurationMs)},
            "updatedAt" = ${nextVersionTimestamp}
          WHERE "clientId" = ${client.id}
            AND "updatedAt" = ${state.updatedAt}
        `
      );

      if (updatedCount === 1) {
        this.logRequest(client.id, decision, Date.now() - startTime, requestCount, attempt).catch(console.error);
        return this.formatResponse(decision, requestCount, requestLimit, startTime, retryAfterSeconds, resetTimestamp);
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
    requestCount: number,
    requestLimit: number,
    startTime: number,
    retryAfterSeconds?: number,
    resetTimestamp?: number
  ) {
    return {
      decision,
      remainingTokens: Math.max(0, requestLimit - requestCount),
      capacity: requestLimit,
      requestCount,
      latencyMs: Date.now() - startTime,
      timestamp: new Date(),
      ...(retryAfterSeconds !== undefined && { retryAfterSeconds }),
      ...(resetTimestamp !== undefined && { resetTimestamp })
    };
  }

  private static async logRequest(clientId: string, decision: RequestDecision, latencyMs: number, requestCount: number, occRetries: number) {
    if (env.ENABLE_RATE_LIMIT_TIMING) {
      console.log(`[FixedWindow Summary] Decision: ${decision}, Total Latency: ${latencyMs}ms, OCC Retries: ${occRetries}`);
    }

    await Promise.all([
      measureQuery('Request Log Insert', () =>
        prisma.requestLog.create({
          data: {
            clientId,
            requestId: randomUUID(),
            algorithm: 'FIXED_WINDOW',
            decision,
            latencyMs,
            remainingTokens: requestCount
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
