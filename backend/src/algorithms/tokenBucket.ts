import { RequestDecision } from '@prisma/client';

export interface TokenBucketInput {
  capacity: number;
  refillRate: number;
  remainingTokens: number;
  lastRefillTime: Date;
  requestTime: Date;
}

export interface TokenBucketOutput {
  decision: RequestDecision;
  remainingTokens: number;
  lastRefillTime: Date;
  retryAfterSeconds?: number;
  resetTimestamp?: number;
}

export const processTokenBucket = (input: TokenBucketInput): TokenBucketOutput => {
  const { capacity, refillRate, remainingTokens, lastRefillTime, requestTime } = input;

  const elapsedMs = Math.max(0, requestTime.getTime() - lastRefillTime.getTime());
  const elapsedSeconds = elapsedMs / 1000;

  const tokensToAdd = elapsedSeconds * refillRate;

  let currentTokens = Math.min(capacity, remainingTokens + tokensToAdd);

  if (currentTokens >= 1) {
    return {
      decision: RequestDecision.ALLOW,
      remainingTokens: currentTokens - 1,
      lastRefillTime: requestTime,
    };
  }

  const msUntilNextToken = Math.max(0, ((1 - currentTokens) / refillRate) * 1000);
  
  return {
    decision: RequestDecision.DENY,
    remainingTokens: currentTokens,
    lastRefillTime: requestTime,
    retryAfterSeconds: Math.ceil(msUntilNextToken / 1000),
    resetTimestamp: Math.floor((requestTime.getTime() + msUntilNextToken) / 1000),
  };
};
