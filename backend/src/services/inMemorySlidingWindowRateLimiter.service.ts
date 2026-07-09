import { processSlidingWindow } from '../algorithms/slidingWindow';
import { RequestDecision } from '@prisma/client';

interface SlidingWindowState {
  windowDurationMs: number;
  requestLimit: number;
  currentWindowCount: number;
  currentWindowStart: number;
  previousWindowCount: number;
  previousWindowStart: number;
  lastAccessTime: Date;
}

export class InMemorySlidingWindowRateLimiterService {
  private static windows = new Map<string, SlidingWindowState>();
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

      const windowStart = Math.floor(arrivalTime.getTime() / this.DEFAULT_WINDOW_DURATION_MS) * this.DEFAULT_WINDOW_DURATION_MS;

      state = {
        windowDurationMs: this.DEFAULT_WINDOW_DURATION_MS,
        requestLimit: this.DEFAULT_REQUEST_LIMIT,
        currentWindowCount: 0,
        currentWindowStart: windowStart,
        previousWindowCount: 0,
        previousWindowStart: windowStart - this.DEFAULT_WINDOW_DURATION_MS,
        lastAccessTime: arrivalTime,
      };
      this.windows.set(clientId, state);
      this.startCleanupTask();
    }

    const result = processSlidingWindow({
      windowDurationMs: state.windowDurationMs,
      requestLimit: state.requestLimit,
      currentWindowCount: state.currentWindowCount,
      currentWindowStart: state.currentWindowStart,
      previousWindowCount: state.previousWindowCount,
      previousWindowStart: state.previousWindowStart,
      requestTime: arrivalTime,
    });

    state.currentWindowCount = result.currentWindowCount;
    state.currentWindowStart = result.currentWindowStart;
    state.previousWindowCount = result.previousWindowCount;
    state.previousWindowStart = result.previousWindowStart;
    state.lastAccessTime = arrivalTime;

    return this.formatResponse(
      result.decision,
      result.effectiveCount,
      state.requestLimit,
      result.overlapPercentage,
      result.previousWindowCount,
      startTime,
      result.retryAfterSeconds,
      result.resetTimestamp
    );
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
