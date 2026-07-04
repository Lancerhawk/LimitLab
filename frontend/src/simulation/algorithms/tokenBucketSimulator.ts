import type { TokenBucketState, SimulationConfig } from '../types';

export function simulateTokenBucket(
  state: TokenBucketState,
  config: SimulationConfig,
  currentTimeMs: number
): { newState: TokenBucketState; decision: 'ALLOW' | 'DENY' } {
  const { capacity, refillRate } = config;

  const elapsedMs = Math.max(0, currentTimeMs - state.lastRefillTimeMs);
  const elapsedSeconds = elapsedMs / 1000;

  const tokensToAdd = elapsedSeconds * refillRate;
  const currentTokens = Math.min(capacity, state.tokens + tokensToAdd);

  if (currentTokens >= 1) {
    return {
      newState: {
        tokens: currentTokens - 1,
        lastRefillTimeMs: currentTimeMs,
      },
      decision: 'ALLOW',
    };
  }

  return {
    newState: {
      tokens: currentTokens,
      lastRefillTimeMs: currentTimeMs,
    },
    decision: 'DENY',
  };
}

export function refillTokenBucket(
  state: TokenBucketState,
  config: SimulationConfig,
  currentTimeMs: number
): TokenBucketState {
  const elapsedMs = Math.max(0, currentTimeMs - state.lastRefillTimeMs);
  const elapsedSeconds = elapsedMs / 1000;
  const tokensToAdd = elapsedSeconds * refillRate(config);
  const currentTokens = Math.min(config.capacity, state.tokens + tokensToAdd);

  return {
    tokens: currentTokens,
    lastRefillTimeMs: currentTimeMs,
  };
}

function refillRate(config: SimulationConfig): number {
  return config.refillRate;
}
