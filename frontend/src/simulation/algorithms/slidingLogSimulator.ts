import type { SlidingLogState, SimulationConfig } from '../types';

export function simulateSlidingLog(
  state: SlidingLogState,
  config: SimulationConfig,
  currentTimeMs: number
): { newState: SlidingLogState; decision: 'ALLOW' | 'DENY' } {
  const { windowDurationMs, requestLimit } = config;

  const cutoff = currentTimeMs - windowDurationMs;
  let startIndex = 0;
  while (startIndex < state.timestamps.length && state.timestamps[startIndex] < cutoff) {
    startIndex++;
  }
  const activeTimestamps = startIndex > 0
    ? state.timestamps.slice(startIndex)
    : [...state.timestamps];

  if (activeTimestamps.length < requestLimit) {
    activeTimestamps.push(currentTimeMs);
    return {
      newState: { timestamps: activeTimestamps },
      decision: 'ALLOW',
    };
  }

  return {
    newState: { timestamps: activeTimestamps },
    decision: 'DENY',
  };
}

export function getSlidingLogInfo(
  state: SlidingLogState,
  config: SimulationConfig,
  currentTimeMs: number
): {
  activeCount: number;
  remaining: number;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
  windowStartMs: number;
  windowEndMs: number;
} {
  const cutoff = currentTimeMs - config.windowDurationMs;
  let startIndex = 0;
  while (startIndex < state.timestamps.length && state.timestamps[startIndex] < cutoff) {
    startIndex++;
  }
  const activeTimestamps = state.timestamps.slice(startIndex);
  const activeCount = activeTimestamps.length;

  return {
    activeCount,
    remaining: Math.max(0, config.requestLimit - activeCount),
    oldestTimestamp: activeTimestamps.length > 0 ? activeTimestamps[0] : null,
    newestTimestamp: activeTimestamps.length > 0 ? activeTimestamps[activeTimestamps.length - 1] : null,
    windowStartMs: cutoff,
    windowEndMs: currentTimeMs,
  };
}
