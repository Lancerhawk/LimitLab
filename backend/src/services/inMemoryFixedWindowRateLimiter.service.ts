import { processFixedWindow } from '../algorithms/fixedWindow';
import { RequestDecision } from '@prisma/client';

interface WindowState {
  windowDurationMs: number;
  requestLimit: number;
  requestCount: number;
  windowStart: number;
  lastAccessTime: Date;
}

export class InMemoryFixedWindowRateLimiterService {
  private static windows = new Map<string, WindowState>();
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static readonly WINDOW_EXPIRY_MS = 30 * 60 * 1000;
  private static readonly MAX_WINDOWS = 100000;

  private static readonly DEFAULT_WINDOW_DURATION_MS = 60000;
  private static readonly DEFAULT_REQUEST_LIMIT = 10;

  static processRequest(clientId: string) {
    const startTime = Date.now();
    const arrivalTime = new Date();

    let state = this.windows.get(clientId);

    if (state) {
      this.windows.delete(clientId);
      this.windows.set(clientId, state);
    } else {
      if (this.windows.size >= this.MAX_WINDOWS) {
        const oldestKey = this.windows.keys().next().value;
        if (oldestKey) this.windows.delete(oldestKey);
      }

      state = {
        windowDurationMs: this.DEFAULT_WINDOW_DURATION_MS,
        requestLimit: this.DEFAULT_REQUEST_LIMIT,
        requestCount: 0,
        windowStart: Math.floor(arrivalTime.getTime() / this.DEFAULT_WINDOW_DURATION_MS) * this.DEFAULT_WINDOW_DURATION_MS,
        lastAccessTime: arrivalTime,
      };
      this.windows.set(clientId, state);
      this.startCleanupTask();
    }

    const { decision, requestCount, windowStart, retryAfterSeconds, resetTimestamp } = processFixedWindow({
      windowDurationMs: state.windowDurationMs,
      requestLimit: state.requestLimit,
      requestCount: state.requestCount,
      windowStart: state.windowStart,
      requestTime: arrivalTime,
    });

    state.requestCount = requestCount;
    state.windowStart = windowStart;
    state.lastAccessTime = arrivalTime;

    return this.formatResponse(decision, requestCount, state.requestLimit, startTime, retryAfterSeconds, resetTimestamp);
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

  private static startCleanupTask() {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [clientId, state] of this.windows.entries()) {
        if (now - state.lastAccessTime.getTime() > this.WINDOW_EXPIRY_MS) {
          this.windows.delete(clientId);
        }
      }

      if (this.windows.size === 0 && this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
    }, 60 * 1000);
  }
}
