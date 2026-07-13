import { prisma } from '../database/prisma';
import { processSlidingLog } from '../algorithms/slidingLog';
import { RequestDecision, RateLimitAlgorithm } from '@prisma/client';
import { randomUUID } from 'crypto';
import { env } from '../config/env';

async function measureQuery<T>(name: string, queryFn: () => Promise<T>): Promise<T> {
  if (!env.ENABLE_RATE_LIMIT_TIMING) return queryFn();
  const start = Date.now();
  try {
    return await queryFn();
  } finally {
    const duration = Date.now() - start;
    console.log(`[SlidingLog DB] ${name}: ${duration}ms`);
  }
}

export class SlidingLogRateLimiterService {
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

    if (client.configuration.algorithm !== RateLimitAlgorithm.SLIDING_LOG) {
      throw new Error('Algorithm mismatch: expected SLIDING_LOG');
    }

    const windowDurationMs = client.configuration.windowDurationMs ?? 60000;
    const requestLimit = client.configuration.requestsPerSecond ?? 10;
    const arrivalTime = new Date();
    const nowMs = arrivalTime.getTime();

    const algoResult = await measureQuery(`SlidingLog Transaction`, () =>
      prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM clients WHERE id = ${client.id} FOR UPDATE`;

        await tx.slidingLogRequest.deleteMany({
          where: {
            clientId: client.id,
            requestTimestamp: { lt: BigInt(nowMs - windowDurationMs) }
          }
        });

        const activeRows = await tx.slidingLogRequest.findMany({
          where: { clientId: client.id },
          orderBy: { requestTimestamp: 'asc' },
          select: { requestTimestamp: true }
        });

        const activeTimestamps = activeRows.map(r => Number(r.requestTimestamp));

        const result = processSlidingLog({
          windowDurationMs,
          requestLimit,
          requestTime: arrivalTime,
          activeTimestamps
        });

        if (result.decision === RequestDecision.ALLOW) {
          await tx.slidingLogRequest.create({
            data: {
              clientId: client.id,
              requestTimestamp: BigInt(nowMs)
            }
          });
        }

        return result;
      })
    );

    const latencyMs = Date.now() - startTime;
    const remainingRequests = Math.max(0, requestLimit - algoResult.activeCount);

    this.logRequest(
      client.id,
      algoResult.decision,
      latencyMs,
      remainingRequests,
      algoResult.retryAfterSeconds
    ).catch(console.error);

    this.updateStats(
      client.id,
      algoResult.decision,
      latencyMs
    ).catch(console.error);

    return this.formatResponse(
      algoResult.decision,
      remainingRequests,
      requestLimit,
      algoResult.retryAfterSeconds,
      algoResult.resetTimestamp,
      startTime
    );
  }

  private static formatResponse(
    decision: RequestDecision,
    remainingRequests: number,
    limit: number,
    retryAfterSeconds: number | undefined,
    resetTimestamp: number | undefined,
    startTime: number
  ) {
    return {
      decision,
      remainingRequests,
      limit,
      retryAfter: retryAfterSeconds,
      resetTimestamp,
      latency: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }

  private static async logRequest(
    clientId: string,
    decision: RequestDecision,
    latencyMs: number,
    remainingTokens: number,
    retryAfterSeconds?: number
  ) {

    await prisma.requestLog.create({
      data: {
        clientId,
        requestId: randomUUID(),
        algorithm: RateLimitAlgorithm.SLIDING_LOG,
        decision,
        latencyMs,
        remainingTokens,
        retryAfterMs: retryAfterSeconds ? retryAfterSeconds * 1000 : null
      }
    });
  }

  private static async updateStats(
    clientId: string,
    decision: RequestDecision,
    _latencyMs: number
  ) {
    if (decision === RequestDecision.ALLOW) {
      await prisma.clientStatistics.updateMany({
        where: { clientId },
        data: {
          totalRequests: { increment: 1 },
          allowedRequests: { increment: 1 },
          lastRequestTime: new Date(),
        }
      });
    } else {
      await prisma.clientStatistics.updateMany({
        where: { clientId },
        data: {
          totalRequests: { increment: 1 },
          deniedRequests: { increment: 1 },
          lastRequestTime: new Date(),
        }
      });
    }
  }
}
