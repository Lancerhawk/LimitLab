import { processTokenBucket } from '../algorithms/tokenBucket';
import { RequestDecision } from '@prisma/client';

interface BucketState {
  capacity: number;
  remainingTokens: number;
  refillRate: number;
  lastRefillTime: Date;
  lastAccessTime: Date;
}

export class InMemoryRateLimiterService {
  private static buckets = new Map<string, BucketState>();
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static readonly BUCKET_EXPIRY_MS = 30 * 60 * 1000;
  private static readonly MAX_BUCKETS = 100000;

  private static readonly DEFAULT_CAPACITY = 10;
  private static readonly DEFAULT_REFILL_RATE = 1;

  static processRequest(clientId: string) {
    const startTime = Date.now();
    const arrivalTime = new Date();

    let state = this.buckets.get(clientId);
    
    if (state) {
      this.buckets.delete(clientId);
      this.buckets.set(clientId, state);
    } else {
      if (this.buckets.size >= this.MAX_BUCKETS) {
        const oldestKey = this.buckets.keys().next().value;
        if (oldestKey) this.buckets.delete(oldestKey);
      }

      state = {
        capacity: this.DEFAULT_CAPACITY,
        remainingTokens: this.DEFAULT_CAPACITY,
        refillRate: this.DEFAULT_REFILL_RATE,
        lastRefillTime: arrivalTime,
        lastAccessTime: arrivalTime,
      };
      this.buckets.set(clientId, state);
      this.startCleanupTask();
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

    return this.formatResponse(decision, remainingTokens, state.capacity, startTime, retryAfterSeconds, resetTimestamp);
  }

  private static formatResponse(
    decision: RequestDecision, 
    remainingTokens: number, 
    capacity: number, 
    startTime: number,
    retryAfterSeconds?: number,
    resetTimestamp?: number
  ) {
    return {
      decision,
      remainingTokens: Math.round(remainingTokens * 100) / 100,
      capacity,
      latencyMs: Date.now() - startTime,
      timestamp: new Date(),
      ...(retryAfterSeconds !== undefined && { retryAfterSeconds }),
      ...(resetTimestamp !== undefined && { resetTimestamp })
    };
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
