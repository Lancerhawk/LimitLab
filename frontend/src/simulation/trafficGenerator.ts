import type { TrafficEvent } from './types';

let eventCounter = 0;

function createEvent(timeMs: number): TrafficEvent {
  return {
    id: `evt-${++eventCounter}-${Math.random().toString(36).slice(2, 8)}`,
    timeMs,
    processed: false,
    decision: null,
    tokensAtTime: null,
  };
}

export function generateConstantTraffic(
  rate: number,
  durationMs: number
): TrafficEvent[] {
  const events: TrafficEvent[] = [];
  if (rate <= 0 || durationMs <= 0) return events;

  const intervalMs = 1000 / rate;

  for (let t = intervalMs; t <= durationMs; t += intervalMs) {
    events.push(createEvent(Math.round(t)));
  }

  return events;
}

export function generateBurstTraffic(
  count: number,
  atTimeMs: number
): TrafficEvent[] {
  const events: TrafficEvent[] = [];
  if (count <= 0) return events;

  for (let i = 0; i < count; i++) {
    events.push(createEvent(atTimeMs));
  }

  return events;
}

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (this.seed >>> 0) / 0xFFFFFFFF;
  }
}

export function generateRandomTraffic(
  avgRate: number,
  variance: number,
  durationMs: number,
  seed: number = 42
): TrafficEvent[] {
  const events: TrafficEvent[] = [];
  if (avgRate <= 0 || durationMs <= 0) return events;

  const rng = new SeededRandom(seed);
  let t = 0;

  while (t < durationMs) {
    const currentRate = Math.max(0.1, avgRate + (rng.next() - 0.5) * 2 * variance);
    const intervalMs = 1000 / currentRate;
    const jitter = -Math.log(1 - rng.next()) * intervalMs;
    t += jitter;

    if (t <= durationMs) {
      events.push(createEvent(Math.round(t)));
    }
  }

  return events.sort((a, b) => a.timeMs - b.timeMs);
}

export function createManualEvent(timeMs: number): TrafficEvent {
  return createEvent(timeMs);
}

export function mergeTraffic(...arrays: TrafficEvent[][]): TrafficEvent[] {
  return arrays.flat().sort((a, b) => a.timeMs - b.timeMs);
}
