import { RequestDecision } from '@prisma/client';

export interface SlidingLogInput {
  windowDurationMs: number;
  requestLimit: number;
  requestTime: Date;
  activeTimestamps: number[];
}

export interface SlidingLogOutput {
  decision: RequestDecision;
  activeCount: number;
  retryAfterSeconds?: number;
  resetTimestamp?: number;
}

export const processSlidingLog = (input: SlidingLogInput): SlidingLogOutput => {
  const { windowDurationMs, requestLimit, requestTime, activeTimestamps } = input;
  const nowMs = requestTime.getTime();

  const activeCount = activeTimestamps.length;

  if (activeCount < requestLimit) {
    return {
      decision: RequestDecision.ALLOW,
      activeCount: activeCount + 1,
    };
  }

  let retryAfterSeconds = 0;
  let resetTimestamp = 0;

  if (activeCount > 0) {
    const oldestTimestamp = activeTimestamps[0];
    const expirationTimeMs = oldestTimestamp + windowDurationMs;
    const msUntilReset = Math.max(0, expirationTimeMs - nowMs);
    retryAfterSeconds = Math.ceil(msUntilReset / 1000);
    resetTimestamp = Math.floor(expirationTimeMs / 1000);
  } else {
    retryAfterSeconds = Math.ceil(windowDurationMs / 1000);
    resetTimestamp = Math.floor((nowMs + windowDurationMs) / 1000);
  }

  return {
    decision: RequestDecision.DENY,
    activeCount,
    retryAfterSeconds,
    resetTimestamp,
  };
};
