import type { SimulationStats, HistoryPoint, TrafficEvent } from './types';

export function computeStats(
  history: HistoryPoint[],
  events: TrafficEvent[]
): SimulationStats {
  let accepted = 0;
  let rejected = 0;
  let totalRequests = 0;
  const burstMap = new Map<number, number>();

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (!e.processed) continue;
    totalRequests++;
    if (e.decision === 'ALLOW') {
      accepted++;
    } else {
      rejected++;
    }
    const key = Math.round(e.timeMs);
    burstMap.set(key, (burstMap.get(key) || 0) + 1);
  }

  const acceptancePercent = totalRequests > 0
    ? Math.round((accepted / totalRequests) * 10000) / 100
    : 0;

  let tokenSum = 0;
  let lowestTokens = Infinity;
  let peakThroughput = 0;
  let longestEmptyDurationMs = 0;
  let currentEmptyStart: number | null = null;
  let refillCount = 0;

  for (let i = 0; i < history.length; i++) {
    const point = history[i];
    tokenSum += point.tokens;

    if (point.tokens < lowestTokens) lowestTokens = point.tokens;
    if (point.accepted > peakThroughput) peakThroughput = point.accepted;

    if (point.tokens <= 0) {
      if (currentEmptyStart === null) currentEmptyStart = point.timeMs;
    } else {
      if (currentEmptyStart !== null) {
        const duration = point.timeMs - currentEmptyStart;
        if (duration > longestEmptyDurationMs) longestEmptyDurationMs = duration;
        currentEmptyStart = null;
      }
    }

    if (i > 0 && point.tokens > history[i - 1].tokens) {
      refillCount++;
    }
  }

  if (currentEmptyStart !== null && history.length > 0) {
    const duration = history[history.length - 1].timeMs - currentEmptyStart;
    if (duration > longestEmptyDurationMs) longestEmptyDurationMs = duration;
  }

  const averageTokens = history.length > 0
    ? Math.round((tokenSum / history.length) * 100) / 100
    : 0;

  if (lowestTokens === Infinity) lowestTokens = 0;

  let largestBurst = 0;
  for (const count of burstMap.values()) {
    if (count > largestBurst) largestBurst = count;
  }

  return {
    totalRequests,
    accepted,
    rejected,
    acceptancePercent,
    averageTokens,
    lowestTokens,
    peakThroughput,
    longestEmptyDurationMs,
    largestBurst,
    refillCount,
  };
}
