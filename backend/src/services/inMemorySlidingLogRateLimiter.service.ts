import { processSlidingLog } from '../algorithms/slidingLog';
import { RequestDecision } from '@prisma/client';
import { prisma } from '../database/prisma';

interface SlidingLogState {
  windowDurationMs: number;
  requestLimit: number;
  timestamps: number[];
  lastAccessTime: Date;
}

export class InMemorySlidingLogRateLimiterService {
  private static logs = new Map<string, SlidingLogState>();
  private static loadingPromises = new Map<string, Promise<void>>();
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static readonly LOG_EXPIRY_MS = 30 * 60 * 1000;
  private static readonly MAX_LOGS = 100000;

  private static readonly DEFAULT_WINDOW_DURATION_MS = 60000;
  private static readonly DEFAULT_REQUEST_LIMIT = 10;

  static async processRequest(clientId: string, isRealClient: boolean = false) {
    const startTime = Date.now();
    const arrivalTime = new Date();
    const nowMs = arrivalTime.getTime();

    let state = this.logs.get(clientId);

    if (state) {
      this.logs.delete(clientId);
      this.logs.set(clientId, state);
    } else {
      let loadingPromise = this.loadingPromises.get(clientId);
      if (!loadingPromise) {
        loadingPromise = (async () => {
          let requestLimit = this.DEFAULT_REQUEST_LIMIT;
          let windowDurationMs = this.DEFAULT_WINDOW_DURATION_MS;

          if (isRealClient) {
            try {
              const dbClient = await prisma.client.findUnique({
                where: { apiKey: clientId },
                include: { configuration: true }
              });
              if (dbClient?.configuration) {
                if (dbClient.configuration.algorithm !== 'SLIDING_LOG') {
                  throw new Error(`Algorithm mismatch: expected SLIDING_LOG but got ${dbClient.configuration.algorithm}`);
                }
                requestLimit = dbClient.configuration.requestsPerSecond ?? requestLimit;
                windowDurationMs = dbClient.configuration.windowDurationMs ?? windowDurationMs;
              }
            } catch (error) {
              console.error(`Failed to fetch config for client ${clientId}:`, error);
              throw error;
            }
          }

          if (this.logs.size >= this.MAX_LOGS) {
            const oldestKey = this.logs.keys().next().value;
            if (oldestKey) this.logs.delete(oldestKey);
          }

          const newState: SlidingLogState = {
            windowDurationMs,
            requestLimit,
            timestamps: [],
            lastAccessTime: new Date(),
          };
          this.logs.set(clientId, newState);
          this.startCleanupTask();
        })();
        this.loadingPromises.set(clientId, loadingPromise);
      }

      await loadingPromise;
      this.loadingPromises.delete(clientId);
      state = this.logs.get(clientId)!;
    }

    let expiredCount = 0;
    while (
      expiredCount < state.timestamps.length &&
      state.timestamps[expiredCount] < nowMs - state.windowDurationMs
    ) {
      expiredCount++;
    }

    if (expiredCount > 0) {
      state.timestamps = state.timestamps.slice(expiredCount);
    }

    const result = processSlidingLog({
      windowDurationMs: state.windowDurationMs,
      requestLimit: state.requestLimit,
      requestTime: arrivalTime,
      activeTimestamps: state.timestamps
    });

    if (result.decision === RequestDecision.ALLOW) {
      state.timestamps.push(nowMs);
    }

    state.lastAccessTime = arrivalTime;

    const remainingRequests = Math.max(0, state.requestLimit - result.activeCount);

    return {
      decision: result.decision,
      remainingRequests,
      limit: state.requestLimit,
      windowMs: state.windowDurationMs,
      retryAfter: result.retryAfterSeconds,
      resetTimestamp: result.resetTimestamp,
      latency: Date.now() - startTime,
      timestamp: arrivalTime.toISOString()
    };
  }

  static getActiveLogsCount() {
    return this.logs.size;
  }

  static clearAll() {
    this.logs.clear();
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  static clearClient(clientId: string) {
    this.logs.delete(clientId);
  }

  private static startCleanupTask() {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let expired = 0;

      for (const [clientId, state] of this.logs.entries()) {
        if (now - state.lastAccessTime.getTime() > this.LOG_EXPIRY_MS) {
          this.logs.delete(clientId);
          expired++;
        }
      }

      if (expired > 0) {
        console.log(`[SlidingLog Memory] Cleaned up ${expired} expired client logs.`);
      }

      if (this.logs.size === 0 && this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
        console.log(`[SlidingLog Memory] No active logs. Cleanup task paused.`);
      }
    }, 60000);
  }
}
