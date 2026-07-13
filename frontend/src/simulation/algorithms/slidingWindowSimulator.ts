import type { SlidingWindowState, SimulationConfig } from '../types';

export function simulateSlidingWindow(
  state: SlidingWindowState,
  config: SimulationConfig,
  currentTimeMs: number
): { newState: SlidingWindowState; decision: 'ALLOW' | 'DENY' } {
  const { windowDurationMs, requestLimit } = config;

  const currentWindow = Math.floor(currentTimeMs / windowDurationMs);
  const storedCurrentWindow = Math.floor(state.currentWindowStartMs / windowDurationMs);

  let curCount = state.currentWindowCount;
  let prevCount = state.previousWindowCount;
  let prevStart = state.previousWindowStartMs;

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
  const elapsedInCurrentWindow = currentTimeMs - windowStartMs;
  const overlapPercentage = Math.max(0, 1 - (elapsedInCurrentWindow / windowDurationMs));

  const effectiveCount = curCount + (prevCount * overlapPercentage);

  if (effectiveCount < requestLimit) {
    return {
      newState: {
        currentWindowCount: curCount + 1,
        currentWindowStartMs: windowStartMs,
        previousWindowCount: prevCount,
        previousWindowStartMs: prevStart,
      },
      decision: 'ALLOW',
    };
  }

  return {
    newState: {
      currentWindowCount: curCount,
      currentWindowStartMs: windowStartMs,
      previousWindowCount: prevCount,
      previousWindowStartMs: prevStart,
    },
    decision: 'DENY',
  };
}

export function getSlidingWindowInfo(
  state: SlidingWindowState,
  config: SimulationConfig,
  currentTimeMs: number
): {
  effectiveCount: number;
  overlapPercentage: number;
  remaining: number;
  windowEndMs: number;
  isNewWindow: boolean;
  currentCount: number;
  previousCount: number;
} {
  const currentWindow = Math.floor(currentTimeMs / config.windowDurationMs);
  const storedWindow = Math.floor(state.currentWindowStartMs / config.windowDurationMs);
  const isNewWindow = currentWindow !== storedWindow;

  const curCount = isNewWindow ? 0 : state.currentWindowCount;
  let prevCount: number;

  if (isNewWindow) {
    if (currentWindow === storedWindow + 1) {
      prevCount = state.currentWindowCount;
    } else {
      prevCount = 0;
    }
  } else {
    prevCount = state.previousWindowCount;
  }

  const windowStartMs = currentWindow * config.windowDurationMs;
  const elapsedInCurrentWindow = currentTimeMs - windowStartMs;
  const overlapPercentage = Math.max(0, 1 - (elapsedInCurrentWindow / config.windowDurationMs));

  const effectiveCount = curCount + (prevCount * overlapPercentage);

  return {
    effectiveCount,
    overlapPercentage,
    remaining: Math.max(0, config.requestLimit - effectiveCount),
    windowEndMs: (currentWindow + 1) * config.windowDurationMs,
    isNewWindow,
    currentCount: curCount,
    previousCount: prevCount,
  };
}
