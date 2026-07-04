import type { FixedWindowState, SimulationConfig } from '../types';

export function simulateFixedWindow(
  state: FixedWindowState,
  config: SimulationConfig,
  currentTimeMs: number
): { newState: FixedWindowState; decision: 'ALLOW' | 'DENY' } {
  const { windowDurationMs, requestLimit } = config;

  const currentWindow = Math.floor(currentTimeMs / windowDurationMs);
  const storedWindow = Math.floor(state.windowStartMs / windowDurationMs);

  let count = state.requestCount;

  if (currentWindow !== storedWindow) {
    count = 0;
  }

  if (count < requestLimit) {
    return {
      newState: {
        requestCount: count + 1,
        windowStartMs: currentWindow * windowDurationMs,
      },
      decision: 'ALLOW',
    };
  }

  return {
    newState: {
      requestCount: count,
      windowStartMs: currentWindow * windowDurationMs,
    },
    decision: 'DENY',
  };
}

export function getWindowInfo(
  state: FixedWindowState,
  config: SimulationConfig,
  currentTimeMs: number
): { remaining: number; windowEndMs: number; isNewWindow: boolean } {
  const currentWindow = Math.floor(currentTimeMs / config.windowDurationMs);
  const storedWindow = Math.floor(state.windowStartMs / config.windowDurationMs);
  const isNewWindow = currentWindow !== storedWindow;
  const count = isNewWindow ? 0 : state.requestCount;

  return {
    remaining: Math.max(0, config.requestLimit - count),
    windowEndMs: (currentWindow + 1) * config.windowDurationMs,
    isNewWindow,
  };
}
