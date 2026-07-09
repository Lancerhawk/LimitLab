import { prisma } from '../database/prisma';
import { RateLimitAlgorithm } from '@prisma/client';
import { randomBytes } from 'crypto';

export class ClientService {
  static async getAllClients() {
    return prisma.client.findMany({
      include: {
        configuration: true,
        bucketState: true,
        windowState: true,
        slidingWindowState: true,
        statistics: true,
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getClientById(id: string) {
    return prisma.client.findUnique({
      where: { id },
      include: {
        configuration: true,
        bucketState: true,
        windowState: true,
        slidingWindowState: true,
        statistics: true,
      }
    });
  }

  static async createClient(data: {
    name: string;
    description?: string;
    algorithm?: string;
    capacity?: number;
    refillRate?: number;
    windowDurationMs?: number;
    requestLimit?: number;
  }) {
    const apiKey = 'pk_test_' + randomBytes(16).toString('hex');
    const algorithm = (data.algorithm as RateLimitAlgorithm) || RateLimitAlgorithm.TOKEN_BUCKET;

    return prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          name: data.name,
          description: data.description,
          apiKey,
        }
      });

      if (algorithm === RateLimitAlgorithm.TOKEN_BUCKET) {
        const capacity = data.capacity ?? 10;
        const refillRate = data.refillRate ?? 1;

        await tx.rateLimitConfiguration.create({
          data: {
            clientId: client.id,
            algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
            burstSize: capacity,
            refillRate: refillRate,
          }
        });

        await tx.bucketState.create({
          data: {
            clientId: client.id,
            remainingTokens: capacity,
            currentCapacity: capacity,
          }
        });
      } else if (algorithm === RateLimitAlgorithm.FIXED_WINDOW) {
        const windowDurationMs = data.windowDurationMs ?? 60000;
        const requestLimit = data.requestLimit ?? 10;

        await tx.rateLimitConfiguration.create({
          data: {
            clientId: client.id,
            algorithm: RateLimitAlgorithm.FIXED_WINDOW,
            requestsPerSecond: requestLimit,
            windowDurationMs: windowDurationMs,
          }
        });

        const now = new Date();
        const windowStart = Math.floor(now.getTime() / windowDurationMs) * windowDurationMs;
        const resetTime = new Date(windowStart + windowDurationMs);

        await tx.windowState.create({
          data: {
            clientId: client.id,
            currentWindow: BigInt(windowStart),
            requestCount: 0,
            resetTime: resetTime,
          }
        });
      } else if (algorithm === RateLimitAlgorithm.SLIDING_WINDOW) {
        const windowDurationMs = data.windowDurationMs ?? 60000;
        const requestLimit = data.requestLimit ?? 10;

        await tx.rateLimitConfiguration.create({
          data: {
            clientId: client.id,
            algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
            requestsPerSecond: requestLimit,
            windowDurationMs: windowDurationMs,
          }
        });

        const now = new Date();
        const windowStart = Math.floor(now.getTime() / windowDurationMs) * windowDurationMs;
        const resetTime = new Date(windowStart + windowDurationMs);

        await tx.slidingWindowState.create({
          data: {
            clientId: client.id,
            currentWindow: BigInt(windowStart),
            requestCount: 0,
            previousWindow: BigInt(windowStart - windowDurationMs),
            previousCount: 0,
            resetTime: resetTime,
          }
        });
      } else if (algorithm === RateLimitAlgorithm.SLIDING_LOG) {
        const windowDurationMs = data.windowDurationMs ?? 60000;
        const requestLimit = data.requestLimit ?? 10;

        await tx.slidingLogRequest.deleteMany({
          where: { clientId: client.id }
        });

        await tx.rateLimitConfiguration.create({
          data: {
            clientId: client.id,
            algorithm: RateLimitAlgorithm.SLIDING_LOG,
            requestsPerSecond: requestLimit,
            windowDurationMs: windowDurationMs,
          }
        });
        // No explicit state model needed for Sliding Log initially,
        // timestamps are created dynamically on requests.
      }

      await tx.clientStatistics.create({
        data: {
          clientId: client.id,
        }
      });

      return tx.client.findUnique({
        where: { id: client.id },
        include: { configuration: true, bucketState: true, windowState: true, slidingWindowState: true, statistics: true }
      });
    });
  }

  static async updateClient(id: string, data: {
    name?: string;
    description?: string;
    capacity?: number;
    refillRate?: number;
    windowDurationMs?: number;
    requestLimit?: number;
    isActive?: boolean;
  }) {
    return prisma.$transaction(async (tx) => {
      if (data.name !== undefined || data.description !== undefined || data.isActive !== undefined) {
        await tx.client.update({
          where: { id },
          data: {
            name: data.name,
            description: data.description,
            isActive: data.isActive,
          }
        });
      }

      const config = await tx.rateLimitConfiguration.findUnique({ where: { clientId: id } });

      if (config?.algorithm === RateLimitAlgorithm.TOKEN_BUCKET) {
        if (data.capacity !== undefined || data.refillRate !== undefined) {
          await tx.rateLimitConfiguration.update({
            where: { clientId: id },
            data: {
              burstSize: data.capacity,
              refillRate: data.refillRate,
            }
          });

          if (data.capacity !== undefined) {
            const state = await tx.bucketState.findUnique({ where: { clientId: id } });
            if (state) {
              await tx.bucketState.update({
                where: { clientId: id },
                data: {
                  currentCapacity: data.capacity,
                  remainingTokens: Math.min(state.remainingTokens, data.capacity)
                }
              });
            }
          }
        }
      } else if (config?.algorithm === RateLimitAlgorithm.FIXED_WINDOW) {
        if (data.windowDurationMs !== undefined || data.requestLimit !== undefined) {
          await tx.rateLimitConfiguration.update({
            where: { clientId: id },
            data: {
              windowDurationMs: data.windowDurationMs,
              requestsPerSecond: data.requestLimit,
            }
          });
        }
      } else if (config?.algorithm === RateLimitAlgorithm.SLIDING_WINDOW || config?.algorithm === RateLimitAlgorithm.SLIDING_LOG) {
        if (data.windowDurationMs !== undefined || data.requestLimit !== undefined) {
          await tx.rateLimitConfiguration.update({
            where: { clientId: id },
            data: {
              windowDurationMs: data.windowDurationMs,
              requestsPerSecond: data.requestLimit,
            }
          });
          
          if (config?.algorithm === RateLimitAlgorithm.SLIDING_LOG) {
            // Optional: When updating config, we could clear the log or just let it naturally expire based on the new window
            // We'll let it naturally expire, no need to delete.
          }
        }
      }

      return tx.client.findUnique({
        where: { id },
        include: { configuration: true, bucketState: true, windowState: true, slidingWindowState: true }
      });
    });
  }

  static async deleteClient(id: string) {
    return prisma.client.delete({
      where: { id }
    });
  }
}

