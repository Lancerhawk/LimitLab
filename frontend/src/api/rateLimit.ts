import api from './axios';

export interface RateLimitResponse {
  decision: 'ALLOW' | 'DENY';
  capacity: number;
  remainingTokens: number;
  retryAfter?: number;
}

export const evaluateRateLimit = async (
  apiKey: string,
  requestCount?: number,
  delayMs?: number
): Promise<RateLimitResponse> => {
  // We use POST as instructed in the backend for rate limit evaluation
  const response = await api.post(
    '/rate-limit', 
    { apiKey, requestCount, delayMs }, 
    {
      // Prevent axios from throwing on 400 or 429 status so we can handle it cleanly
      validateStatus: (status) => status === 200 || status === 429 || status === 400
    }
  );
  
  if (response.status === 400) {
    throw new Error(response.data.error || 'Validation error');
  }

  return response.data;
};
