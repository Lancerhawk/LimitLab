import { processLeakyBucket } from '../algorithms/leakyBucket';
import { RequestDecision } from '@prisma/client';
import { prisma } from '../database/prisma';

interface LeakyBucketState {
  queueCapacity: number;
  queueLength: number;
  leakRate: number;
  lastLeakTime: Date;
  lastAccessTime: Date;
}

export class InMemoryLeakyBucketRateLimiterService {
  private static buckets = new Map<string, LeakyBucketState>();
  private static loadingPromises = new Map<string, Promise<void>>();
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static readonly BUCKET_EXPIRY_MS = 30 * 60 * 1000;
  private static readonly MAX_BUCKETS = 100000;

  private static readonly DEFAULT_CAPACITY = 10;
  private static readonly DEFAULT_LEAK_RATE = 1;

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
          let queueCapacity = this.DEFAULT_CAPACITY;
          let leakRate = this.DEFAULT_LEAK_RATE;

          if (isRealClient) {
            try {
              const dbClient = await prisma.client.findUnique({
                where: { apiKey: clientId },
                include: { configuration: true }
              });
              if (dbClient?.configuration) {
                if (dbClient.configuration.algorithm !== 'LEAKY_BUCKET') {
                  throw new Error(`Algorithm mismatch: expected LEAKY_BUCKET but got ${dbClient.configuration.algorithm}`);
                }
                queueCapacity = dbClient.configuration.queueCapacity ?? dbClient.configuration.burstSize ?? queueCapacity;
                leakRate = dbClient.configuration.leakRate ?? leakRate;
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

          const newState: LeakyBucketState = {
            queueCapacity,
            queueLength: 0,
            leakRate,
            lastLeakTime: new Date(),
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

    const { decision, queueLength, lastLeakTime, retryAfterSeconds, resetTimestamp } = processLeakyBucket({
      queueCapacity: state.queueCapacity,
      leakRate: state.leakRate,
      queueLength: state.queueLength,
      lastLeakTime: state.lastLeakTime,
      requestTime: arrivalTime,
    });

    state.queueLength = queueLength;
    state.lastLeakTime = lastLeakTime;
    state.lastAccessTime = arrivalTime;

    return this.formatResponse(
      decision,
      state.queueCapacity - queueLength,
      queueLength,
      state.queueCapacity,
      startTime,
      state.leakRate,
      retryAfterSeconds,
      resetTimestamp
    );
  }

  private static formatResponse(
    decision: RequestDecision,
    remainingCapacity: number,
    queueLength: number,
    capacity: number,
    startTime: number,
    leakRate: number,
    retryAfterSeconds?: number,
    resetTimestamp?: number
  ) {
    return {
      decision,
      remainingCapacity: Math.max(0, remainingCapacity),
      queueLength,
      capacity,
      leakRate,
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
