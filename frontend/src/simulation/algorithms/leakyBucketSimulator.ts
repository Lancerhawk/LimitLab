import type { SimulationConfig, TrafficEvent, LeakyBucketState } from '../types';

export const getInitialLeakyBucketState = (_config: SimulationConfig): LeakyBucketState => {
  return {
    queueLength: 0,
    lastLeakTimeMs: 0,
  };
};

export const advanceLeakyBucketTime = (
  state: LeakyBucketState,
  config: SimulationConfig,
  currentTimeMs: number
): LeakyBucketState => {
  if (state.lastLeakTimeMs === 0) {
    return { ...state, lastLeakTimeMs: currentTimeMs };
  }

  const elapsedMs = Math.max(0, currentTimeMs - state.lastLeakTimeMs);
  const elapsedSeconds = elapsedMs / 1000;
  const leakedRequests = elapsedSeconds * config.refillRate; // refillRate is used as leakRate

  return {
    queueLength: Math.max(0, state.queueLength - leakedRequests),
    lastLeakTimeMs: currentTimeMs,
  };
};

export const processLeakyBucketRequest = (
  state: LeakyBucketState,
  config: SimulationConfig,
  event: TrafficEvent
): { newState: LeakyBucketState; decision: 'ALLOW' | 'DENY'; queueLength: number } => {
  // First, advance time to the event's exact timestamp
  const advancedState = advanceLeakyBucketTime(state, config, event.timeMs);

  // Then process the request
  const capacity = config.capacity; // Capacity used as Queue Capacity

  // You must have room for at least 1 full request to enter the queue
  if (advancedState.queueLength + 1 <= capacity) {
    // There is room in the queue
    const newState = {
      ...advancedState,
      queueLength: advancedState.queueLength + 1,
    };
    return {
      newState,
      decision: 'ALLOW',
      queueLength: newState.queueLength,
    };
  }

  // Queue is full
  return {
    newState: advancedState, // Unchanged
    decision: 'DENY',
    queueLength: advancedState.queueLength,
  };
};
