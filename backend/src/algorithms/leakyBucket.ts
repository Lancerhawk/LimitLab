import { RequestDecision } from '@prisma/client';

export interface LeakyBucketInput {
  queueCapacity: number;
  leakRate: number;
  queueLength: number;
  lastLeakTime: Date;
  requestTime: Date;
}

export interface LeakyBucketOutput {
  decision: RequestDecision;
  queueLength: number;
  lastLeakTime: Date;
  retryAfterSeconds?: number;
  resetTimestamp?: number;
}

export const processLeakyBucket = (input: LeakyBucketInput): LeakyBucketOutput => {
  const { queueCapacity, leakRate, queueLength, lastLeakTime, requestTime } = input;

  const elapsedMs = Math.max(0, requestTime.getTime() - lastLeakTime.getTime());
  const elapsedSeconds = elapsedMs / 1000;

  const leakedRequests = elapsedSeconds * leakRate;

  const currentQueueLength = Math.max(0, queueLength - leakedRequests);

  if (currentQueueLength + 1 <= queueCapacity) {
    return {
      decision: RequestDecision.ALLOW,
      queueLength: currentQueueLength + 1,
      lastLeakTime: requestTime,
    };
  }

  const overflow = (currentQueueLength + 1) - queueCapacity;
  const secondsUntilSlot = overflow / leakRate;

  return {
    decision: RequestDecision.DENY,
    queueLength: currentQueueLength,
    lastLeakTime: requestTime,
    retryAfterSeconds: Math.ceil(secondsUntilSlot),
    resetTimestamp: Math.floor(requestTime.getTime() / 1000 + secondsUntilSlot),
  };
};
