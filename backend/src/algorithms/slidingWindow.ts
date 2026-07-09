import { RequestDecision } from '@prisma/client';

export interface SlidingWindowInput {
  windowDurationMs: number;
  requestLimit: number;
  currentWindowCount: number;
  currentWindowStart: number;
  previousWindowCount: number;
  previousWindowStart: number;
  requestTime: Date;
}

export interface SlidingWindowOutput {
  decision: RequestDecision;
  currentWindowCount: number;
  currentWindowStart: number;
  previousWindowCount: number;
  previousWindowStart: number;
  effectiveCount: number;
  overlapPercentage: number;
  retryAfterSeconds?: number;
  resetTimestamp?: number;
}

export const processSlidingWindow = (input: SlidingWindowInput): SlidingWindowOutput => {
  const {
    windowDurationMs,
    requestLimit,
    currentWindowCount,
    currentWindowStart,
    previousWindowCount,
    previousWindowStart,
    requestTime,
  } = input;

  const nowMs = requestTime.getTime();
  const currentWindow = Math.floor(nowMs / windowDurationMs);
  const storedCurrentWindow = Math.floor(currentWindowStart / windowDurationMs);

  let curCount = currentWindowCount;
  let prevCount = previousWindowCount;
  let prevStart = previousWindowStart;

  if (currentWindow !== storedCurrentWindow) {
    if (currentWindow === storedCurrentWindow + 1) {
      prevCount = curCount;
      prevStart = storedCurrentWindow * windowDurationMs;
    } else {
      prevCount = 0;
      prevStart = (currentWindow - 1) * windowDurationMs;
    }
    curCount = 0;
  }

  const windowStartMs = currentWindow * windowDurationMs;
  const elapsedInCurrentWindow = nowMs - windowStartMs;
  const overlapPercentage = Math.max(0, 1 - (elapsedInCurrentWindow / windowDurationMs));

  const effectiveCount = curCount + (prevCount * overlapPercentage);

  const windowEndMs = (currentWindow + 1) * windowDurationMs;

  if (effectiveCount < requestLimit) {
    return {
      decision: RequestDecision.ALLOW,
      currentWindowCount: curCount + 1,
      currentWindowStart: windowStartMs,
      previousWindowCount: prevCount,
      previousWindowStart: prevStart,
      effectiveCount: effectiveCount + 1,
      overlapPercentage,
    };
  }

  const msUntilReset = Math.max(0, windowEndMs - nowMs);

  return {
    decision: RequestDecision.DENY,
    currentWindowCount: curCount,
    currentWindowStart: windowStartMs,
    previousWindowCount: prevCount,
    previousWindowStart: prevStart,
    effectiveCount,
    overlapPercentage,
    retryAfterSeconds: Math.ceil(msUntilReset / 1000),
    resetTimestamp: Math.floor(windowEndMs / 1000),
  };
};
