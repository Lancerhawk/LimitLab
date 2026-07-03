import { RequestDecision } from '@prisma/client';

export interface FixedWindowInput {
  windowDurationMs: number;
  requestLimit: number;
  requestCount: number;
  windowStart: number;
  requestTime: Date;
}

export interface FixedWindowOutput {
  decision: RequestDecision;
  requestCount: number;
  windowStart: number;
  retryAfterSeconds?: number;
  resetTimestamp?: number;
}

export const processFixedWindow = (input: FixedWindowInput): FixedWindowOutput => {
  const { windowDurationMs, requestLimit, requestCount, windowStart, requestTime } = input;

  const nowMs = requestTime.getTime();
  const currentWindow = Math.floor(nowMs / windowDurationMs);
  const storedWindow = Math.floor(windowStart / windowDurationMs);

  let count = requestCount;

  if (currentWindow !== storedWindow) {
    count = 0;
  }

  const windowEndMs = (currentWindow + 1) * windowDurationMs;

  if (count < requestLimit) {
    return {
      decision: RequestDecision.ALLOW,
      requestCount: count + 1,
      windowStart: currentWindow * windowDurationMs,
    };
  }

  const msUntilReset = Math.max(0, windowEndMs - nowMs);

  return {
    decision: RequestDecision.DENY,
    requestCount: count,
    windowStart: currentWindow * windowDurationMs,
    retryAfterSeconds: Math.ceil(msUntilReset / 1000),
    resetTimestamp: Math.floor(windowEndMs / 1000),
  };
};
