import api from './axios';

export interface RateLimitResponse {
  decision: 'ALLOW' | 'DENY';
  capacity?: number;
  remainingTokens?: number;
  limit?: number;
  remainingRequests?: number;
  requestCount?: number;
  retryAfter?: number;
  retryAfterSeconds?: number;
  resetTimestamp?: number;
  queueLength?: number;
  remainingCapacity?: number;
  leakRate?: number;
}

export const evaluateRateLimit = async (
  apiKey: string,
  requestCount?: number,
  delayMs?: number
): Promise<RateLimitResponse> => {
  const response = await api.post(
    '/rate-limit', 
    { apiKey, requestCount, delayMs }, 
    {
      validateStatus: (status) => status === 200 || status === 429 || status === 400
    }
  );
  
  if (response.status === 400) {
    throw new Error(response.data.error || 'Validation error');
  }

  return response.data;
};

export const evaluateFixedWindowRateLimit = async (
  apiKey: string,
  requestCount?: number,
  delayMs?: number
): Promise<RateLimitResponse> => {
  const response = await api.post(
    '/rate-limit/fixed-window',
    { apiKey, requestCount, delayMs },
    {
      validateStatus: (status) => status === 200 || status === 429 || status === 400
    }
  );

  if (response.status === 400) {
    throw new Error(response.data.error || 'Validation error');
  }

  return response.data;
};

export const evaluateSlidingWindowRateLimit = async (
  apiKey: string,
  requestCount?: number,
  delayMs?: number
): Promise<RateLimitResponse> => {
  const response = await api.post(
    '/rate-limit/sliding-window',
    { apiKey, requestCount, delayMs },
    {
      validateStatus: (status) => status === 200 || status === 429 || status === 400
    }
  );

  if (response.status === 400) {
    throw new Error(response.data.error || 'Validation error');
  }

  return response.data;
};

export const evaluateSlidingLogRateLimit = async (
  apiKey: string,
  requestCount?: number,
  delayMs?: number
): Promise<RateLimitResponse> => {
  const response = await api.post(
    '/rate-limit/sliding-log',
    { apiKey, requestCount, delayMs },
    {
      validateStatus: (status) => status === 200 || status === 429 || status === 400
    }
  );

  if (response.status === 400) {
    throw new Error(response.data.error || 'Validation error');
  }

  return response.data;
};

export const evaluateLeakyBucketRateLimit = async (
  apiKey: string,
  requestCount?: number,
  delayMs?: number
): Promise<RateLimitResponse> => {
  const response = await api.post(
    '/rate-limit/leaky-bucket',
    { apiKey, requestCount, delayMs },
    {
      validateStatus: (status) => status === 200 || status === 429 || status === 400
    }
  );

  if (response.status === 400) {
    throw new Error(response.data.error || 'Validation error');
  }

  return response.data;
};
