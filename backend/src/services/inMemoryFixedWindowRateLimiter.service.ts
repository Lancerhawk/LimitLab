import { processFixedWindow } from '../algorithms/fixedWindow';
import { RequestDecision } from '@prisma/client';
import { prisma } from '../database/prisma';

interface WindowState {
  windowDurationMs: number;
  requestLimit: number;
  requestCount: number;
  windowStart: number;
  lastAccessTime: Date;
}

export class InMemoryFixedWindowRateLimiterService {
  private static windows = new Map<string, WindowState>();
  private static loadingPromises = new Map<string, Promise<void>>();
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static readonly WINDOW_EXPIRY_MS = 30 * 60 * 1000;
  private static readonly MAX_WINDOWS = 100000;

  private static readonly DEFAULT_WINDOW_DURATION_MS = 60000;
  private static readonly DEFAULT_REQUEST_LIMIT = 10;

  static async processRequest(clientId: string, isRealClient: boolean = false) {
    const startTime = Date.now();
    const arrivalTime = new Date();

    let state = this.windows.get(clientId);

    if (state) {
      this.windows.delete(clientId);
      this.windows.set(clientId, state);
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
                if (dbClient.configuration.algorithm !== 'FIXED_WINDOW') {
                  throw new Error(`Algorithm mismatch: expected FIXED_WINDOW but got ${dbClient.configuration.algorithm}`);
                }
                requestLimit = dbClient.configuration.requestsPerSecond ?? requestLimit;
                windowDurationMs = dbClient.configuration.windowDurationMs ?? windowDurationMs;
              }
            } catch (error) {
              console.error(`Failed to fetch config for client ${clientId}:`, error);
              throw error;
            }
          }

          if (this.windows.size >= this.MAX_WINDOWS) {
            const oldestKey = this.windows.keys().next().value;
            if (oldestKey) this.windows.delete(oldestKey);
          }

          const newState: WindowState = {
            windowDurationMs,
            requestLimit,
            requestCount: 0,
            windowStart: Math.floor(new Date().getTime() / windowDurationMs) * windowDurationMs,
            lastAccessTime: new Date(),
          };
          this.windows.set(clientId, newState);
          this.startCleanupTask();
        })();
        this.loadingPromises.set(clientId, loadingPromise);
      }
      
      await loadingPromise;
      this.loadingPromises.delete(clientId);
      state = this.windows.get(clientId)!;
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
    return this.formatResponse(decision, requestCount, state.requestLimit, state.windowDurationMs, startTime, retryAfterSeconds, resetTimestamp);
  }

  private static formatResponse(
    decision: RequestDecision,
    requestCount: number,
    requestLimit: number,
    windowDurationMs: number,
    startTime: number,
    retryAfterSeconds?: number,
    resetTimestamp?: number
  ) {
    return {
      decision,
      remainingTokens: Math.max(0, requestLimit - requestCount),
      capacity: requestLimit,
      windowMs: windowDurationMs,
      requestCount,
      latencyMs: Date.now() - startTime,
      timestamp: new Date(),
      ...(retryAfterSeconds !== undefined && { retryAfterSeconds }),
      ...(resetTimestamp !== undefined && { resetTimestamp })
    };
  }

  static clearClient(clientId: string) {
    this.windows.delete(clientId);
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
