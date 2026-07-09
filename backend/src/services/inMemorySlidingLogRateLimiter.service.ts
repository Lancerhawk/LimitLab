import { processSlidingLog } from '../algorithms/slidingLog';
import { RequestDecision } from '@prisma/client';

interface SlidingLogState {
  windowDurationMs: number;
  requestLimit: number;
  timestamps: number[];
  lastAccessTime: Date;
}

export class InMemorySlidingLogRateLimiterService {
  private static logs = new Map<string, SlidingLogState>();
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static readonly LOG_EXPIRY_MS = 30 * 60 * 1000;
  private static readonly MAX_LOGS = 100000;

  private static readonly DEFAULT_WINDOW_DURATION_MS = 60000;
  private static readonly DEFAULT_REQUEST_LIMIT = 10;

  static processRequest(clientId: string) {
    const startTime = Date.now();
    const arrivalTime = new Date();
    const nowMs = arrivalTime.getTime();

    let state = this.logs.get(clientId);

    if (state) {
      this.logs.delete(clientId);
      this.logs.set(clientId, state);
    } else {
      if (this.logs.size >= this.MAX_LOGS) {
        const oldestKey = this.logs.keys().next().value;
        if (oldestKey) this.logs.delete(oldestKey);
      }

      state = {
        windowDurationMs: this.DEFAULT_WINDOW_DURATION_MS,
        requestLimit: this.DEFAULT_REQUEST_LIMIT,
        timestamps: [],
        lastAccessTime: arrivalTime,
      };
      this.logs.set(clientId, state);
      this.startCleanupTask();
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
