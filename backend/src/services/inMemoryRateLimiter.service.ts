import { processTokenBucket } from '../algorithms/tokenBucket';
import { RequestDecision } from '@prisma/client';
import { prisma } from '../database/prisma';

interface BucketState {
  capacity: number;
  remainingTokens: number;
  refillRate: number;
  lastRefillTime: Date;
  lastAccessTime: Date;
}

export class InMemoryRateLimiterService {
  private static buckets = new Map<string, BucketState>();
  private static loadingPromises = new Map<string, Promise<void>>();
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static readonly BUCKET_EXPIRY_MS = 30 * 60 * 1000;
  private static readonly MAX_BUCKETS = 100000;

  private static readonly DEFAULT_CAPACITY = 10;
  private static readonly DEFAULT_REFILL_RATE = 1;

  static async processRequest(clientId: string, isRealClient: boolean = false) {
    const startTime = Date.now();
    const arrivalTime = new Date();

    let state = this.buckets.get(clientId);
    
    if (state) {
      this.buckets.delete(clientId);
      this.buckets.set(clientId, state);
    } else {
      let loadingPromise = this.loadingPromises.get(clientId);
      if (!loadingPromise) {
        loadingPromise = (async () => {
          let capacity = this.DEFAULT_CAPACITY;
          let refillRate = this.DEFAULT_REFILL_RATE;

          if (isRealClient) {
            try {
              const dbClient = await prisma.client.findUnique({
                where: { apiKey: clientId },
                include: { configuration: true }
              });
              if (dbClient?.configuration) {
                if (dbClient.configuration.algorithm !== 'TOKEN_BUCKET') {
                  throw new Error(`Algorithm mismatch: expected TOKEN_BUCKET but got ${dbClient.configuration.algorithm}`);
                }
                capacity = dbClient.configuration.burstSize ?? dbClient.configuration.requestsPerSecond ?? capacity;
                refillRate = dbClient.configuration.refillRate ?? refillRate;
              }
            } catch (error) {
              console.error(`Failed to fetch config for client ${clientId}:`, error);
              throw error;
            }
          }

          if (this.buckets.size >= this.MAX_BUCKETS) {
            const oldestKey = this.buckets.keys().next().value;
            if (oldestKey) this.buckets.delete(oldestKey);
          }

          const newState: BucketState = {
            capacity,
            remainingTokens: capacity,
            refillRate,
            lastRefillTime: new Date(),
            lastAccessTime: new Date(),
          };
          this.buckets.set(clientId, newState);
          this.startCleanupTask();
        })();
        this.loadingPromises.set(clientId, loadingPromise);
      }
      
      await loadingPromise;
      this.loadingPromises.delete(clientId);
      state = this.buckets.get(clientId)!;
    }

    const { decision, remainingTokens, lastRefillTime, retryAfterSeconds, resetTimestamp } = processTokenBucket({
      capacity: state.capacity,
      refillRate: state.refillRate,
      remainingTokens: state.remainingTokens,
      lastRefillTime: state.lastRefillTime,
      requestTime: arrivalTime,
    });

    if (decision === RequestDecision.ALLOW) {
      state.remainingTokens = remainingTokens;
      state.lastRefillTime = lastRefillTime;
    }
    
    state.lastAccessTime = arrivalTime;

    return this.formatResponse(decision, remainingTokens, state.capacity, state.refillRate, startTime, retryAfterSeconds, resetTimestamp);
  }

  private static formatResponse(
    decision: RequestDecision, 
    remainingTokens: number, 
    capacity: number, 
    refillRate: number,
    startTime: number,
    retryAfterSeconds?: number,
    resetTimestamp?: number
  ) {
    return {
      decision,
      remainingTokens: Math.round(remainingTokens * 100) / 100,
      capacity,
      refillRate,
      latencyMs: Date.now() - startTime,
      timestamp: new Date(),
      ...(retryAfterSeconds !== undefined && { retryAfterSeconds }),
      ...(resetTimestamp !== undefined && { resetTimestamp })
    };
  }

  static clearClient(clientId: string) {
    this.buckets.delete(clientId);
  }

  private static startCleanupTask() {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [clientId, state] of this.buckets.entries()) {
        if (now - state.lastAccessTime.getTime() > this.BUCKET_EXPIRY_MS) {
          this.buckets.delete(clientId);
        }
      }

      if (this.buckets.size === 0 && this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
    }, 60 * 1000);
  }
}
