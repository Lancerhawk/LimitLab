import { Request, Response } from 'express';
import { RateLimiterService } from '../services/rateLimiter.service';
import { InMemoryRateLimiterService } from '../services/inMemoryRateLimiter.service';
import { FixedWindowRateLimiterService } from '../services/fixedWindowRateLimiter.service';
import { InMemoryFixedWindowRateLimiterService } from '../services/inMemoryFixedWindowRateLimiter.service';
import { SlidingWindowRateLimiterService } from '../services/slidingWindowRateLimiter.service';
import { InMemorySlidingWindowRateLimiterService } from '../services/inMemorySlidingWindowRateLimiter.service';
import { SlidingLogRateLimiterService } from '../services/slidingLogRateLimiter.service';
import { InMemorySlidingLogRateLimiterService } from '../services/inMemorySlidingLogRateLimiter.service';
import { LeakyBucketRateLimiterService } from '../services/leakyBucketRateLimiter.service';
import { InMemoryLeakyBucketRateLimiterService } from '../services/inMemoryLeakyBucketRateLimiter.service';

export class RateLimitController {
  static async process(req: Request, res: Response) {
    try {
      const apiKey = req.headers['x-api-key'] || req.body.apiKey;

      if (!apiKey || typeof apiKey !== 'string') {
        return res.status(401).json({ error: 'API Key is missing or invalid' });
      }

      if (req.body.requestCount !== undefined) {
        const count = Number(req.body.requestCount);
        if (isNaN(count) || count < 1 || count > 100) {
          return res.status(400).json({ error: 'Request count must be between 1 and 100.' });
        }
      }

      if (req.body.delayMs !== undefined) {
        const delay = Number(req.body.delayMs);
        if (isNaN(delay) || delay < 600 || delay > 60000) {
          return res.status(400).json({ error: 'Delay must be between 600ms and 60000ms.' });
        }
      }

      const result = await RateLimiterService.processRequest(apiKey);

      res.set({
        'X-RateLimit-Limit': result.capacity.toString(),
        'X-RateLimit-Remaining': result.remainingTokens.toString(),
      });

      if (result.decision === 'ALLOW') {
        res.status(200).json(result);
      } else {
        res.status(429).json({ error: 'Too Many Requests', ...result });
      }
    } catch (error: any) {
      if (error.message === 'UNAUTHORIZED') {
        return res.status(401).json({ error: 'Invalid API Key' });
      }
      if (error.message === 'RATE_LIMITER_UNAVAILABLE') {
        return res.status(503).json({ error: 'Rate limiter temporarily unavailable. Please try again.' });
      }
      res.status(500).json({ error: 'Rate limiter error', details: error.message });
    }
  }
  static async processMemory(req: Request, res: Response) {
    try {
      let clientId = req.headers['x-client-id'] as string;
      let isRealClient = true;
      if (!clientId) {
        clientId = req.ip || 'unknown-client';
        isRealClient = false;
      }

      const result = await InMemoryRateLimiterService.processRequest(clientId, isRealClient);

      res.setHeader('X-RateLimit-Limit', result.capacity.toString());
      res.setHeader('X-RateLimit-Remaining', Math.floor(result.remainingTokens).toString());

      if (result.resetTimestamp !== undefined) {
        res.setHeader('X-RateLimit-Reset', result.resetTimestamp.toString());
      }

      if (result.decision === 'DENY') {
        if (result.retryAfterSeconds !== undefined) {
          res.setHeader('Retry-After', result.retryAfterSeconds.toString());
        }
        res.status(429).json(result);
      } else {
        res.status(200).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ error: 'In-memory rate limiter error', details: error.message });
    }
  }

  static async processFixedWindow(req: Request, res: Response) {
    try {
      const apiKey = req.headers['x-api-key'] || req.body.apiKey;

      if (!apiKey || typeof apiKey !== 'string') {
        return res.status(401).json({ error: 'API Key is missing or invalid' });
      }

      if (req.body.requestCount !== undefined) {
        const count = Number(req.body.requestCount);
        if (isNaN(count) || count < 1 || count > 100) {
          return res.status(400).json({ error: 'Request count must be between 1 and 100.' });
        }
      }

      if (req.body.delayMs !== undefined) {
        const delay = Number(req.body.delayMs);
        if (isNaN(delay) || delay < 600 || delay > 60000) {
          return res.status(400).json({ error: 'Delay must be between 600ms and 60000ms.' });
        }
      }

      const result = await FixedWindowRateLimiterService.processRequest(apiKey);

      res.set({
        'X-RateLimit-Limit': result.capacity.toString(),
        'X-RateLimit-Remaining': result.remainingTokens.toString(),
      });

      if (result.resetTimestamp !== undefined) {
        res.setHeader('X-RateLimit-Reset', result.resetTimestamp.toString());
      }

      if (result.decision === 'ALLOW') {
        res.status(200).json(result);
      } else {
        if (result.retryAfterSeconds !== undefined) {
          res.setHeader('Retry-After', result.retryAfterSeconds.toString());
        }
        res.status(429).json({ error: 'Too Many Requests', ...result });
      }
    } catch (error: any) {
      if (error.message === 'UNAUTHORIZED') {
        return res.status(401).json({ error: 'Invalid API Key' });
      }
      if (error.message === 'RATE_LIMITER_UNAVAILABLE') {
        return res.status(503).json({ error: 'Rate limiter temporarily unavailable. Please try again.' });
      }
      res.status(500).json({ error: 'Fixed Window rate limiter error', details: error.message });
    }
  }

  static async processFixedWindowMemory(req: Request, res: Response) {
    try {
      let clientId = req.headers['x-client-id'] as string;
      let isRealClient = true;
      if (!clientId) {
        clientId = req.ip || 'unknown-client';
        isRealClient = false;
      }

      const result = await InMemoryFixedWindowRateLimiterService.processRequest(clientId, isRealClient);

      res.setHeader('X-RateLimit-Limit', result.capacity.toString());
      res.setHeader('X-RateLimit-Remaining', result.remainingTokens.toString());

      if (result.resetTimestamp !== undefined) {
        res.setHeader('X-RateLimit-Reset', result.resetTimestamp.toString());
      }

      if (result.decision === 'DENY') {
        if (result.retryAfterSeconds !== undefined) {
          res.setHeader('Retry-After', result.retryAfterSeconds.toString());
        }
        res.status(429).json(result);
      } else {
        res.status(200).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ error: 'In-memory Fixed Window rate limiter error', details: error.message });
    }
  }

  static async processSlidingWindow(req: Request, res: Response) {
    try {
      const apiKey = req.headers['x-api-key'] || req.body.apiKey;

      if (!apiKey || typeof apiKey !== 'string') {
        return res.status(401).json({ error: 'API Key is missing or invalid' });
      }

      if (req.body.requestCount !== undefined) {
        const count = Number(req.body.requestCount);
        if (isNaN(count) || count < 1 || count > 100) {
          return res.status(400).json({ error: 'Request count must be between 1 and 100.' });
        }
      }

      if (req.body.delayMs !== undefined) {
        const delay = Number(req.body.delayMs);
        if (isNaN(delay) || delay < 600 || delay > 60000) {
          return res.status(400).json({ error: 'Delay must be between 600ms and 60000ms.' });
        }
      }

      const result = await SlidingWindowRateLimiterService.processRequest(apiKey);

      res.set({
        'X-RateLimit-Limit': result.capacity.toString(),
        'X-RateLimit-Remaining': result.remainingTokens.toString(),
      });

      if (result.resetTimestamp !== undefined) {
        res.setHeader('X-RateLimit-Reset', result.resetTimestamp.toString());
      }

      if (result.decision === 'ALLOW') {
        res.status(200).json(result);
      } else {
        if (result.retryAfterSeconds !== undefined) {
          res.setHeader('Retry-After', result.retryAfterSeconds.toString());
        }
        res.status(429).json({ error: 'Too Many Requests', ...result });
      }
    } catch (error: any) {
      if (error.message === 'UNAUTHORIZED') {
        return res.status(401).json({ error: 'Invalid API Key' });
      }
      if (error.message === 'RATE_LIMITER_UNAVAILABLE') {
        return res.status(503).json({ error: 'Rate limiter temporarily unavailable. Please try again.' });
      }
      res.status(500).json({ error: 'Sliding Window rate limiter error', details: error.message });
    }
  }

  static async processSlidingWindowMemory(req: Request, res: Response) {
    try {
      let clientId = req.headers['x-client-id'] as string;
      let isRealClient = true;
      if (!clientId) {
        clientId = req.ip || 'unknown-client';
        isRealClient = false;
      }

      const result = await InMemorySlidingWindowRateLimiterService.processRequest(clientId, isRealClient);

      res.setHeader('X-RateLimit-Limit', result.capacity.toString());
      res.setHeader('X-RateLimit-Remaining', result.remainingTokens.toString());

      if (result.resetTimestamp !== undefined) {
        res.setHeader('X-RateLimit-Reset', result.resetTimestamp.toString());
      }

      if (result.decision === 'DENY') {
        if (result.retryAfterSeconds !== undefined) {
          res.setHeader('Retry-After', result.retryAfterSeconds.toString());
        }
        res.status(429).json(result);
      } else {
        res.status(200).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ error: 'In-memory Sliding Window rate limiter error', details: error.message });
    }
  }

  static async processSlidingLog(req: Request, res: Response) {
    try {
      const apiKey = req.headers['x-api-key'] || req.body.apiKey;

      if (!apiKey || typeof apiKey !== 'string') {
        return res.status(401).json({ error: 'API Key is missing or invalid' });
      }

      const result = await SlidingLogRateLimiterService.processRequest(apiKey);

      res.set({
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remainingRequests.toString(),
      });

      if (result.resetTimestamp !== undefined) {
        res.setHeader('X-RateLimit-Reset', result.resetTimestamp.toString());
      }

      if (result.decision === 'ALLOW') {
        res.status(200).json(result);
      } else {
        if (result.retryAfter !== undefined) {
          res.setHeader('Retry-After', result.retryAfter.toString());
        }
        res.status(429).json({ error: 'Too Many Requests', ...result });
      }
    } catch (error: any) {
      if (error.message === 'UNAUTHORIZED') {
        return res.status(401).json({ error: 'Invalid API Key' });
      }
      if (error.message === 'RATE_LIMITER_UNAVAILABLE') {
        return res.status(503).json({ error: 'Rate limiter temporarily unavailable. Please try again.' });
      }
      res.status(500).json({ error: 'Sliding Log rate limiter error', details: error.message });
    }
  }

  static async processSlidingLogMemory(req: Request, res: Response) {
    try {
      let clientId = req.headers['x-client-id'] as string;
      let isRealClient = true;
      if (!clientId) {
        clientId = req.ip || 'unknown-client';
        isRealClient = false;
      }

      const result = await InMemorySlidingLogRateLimiterService.processRequest(clientId, isRealClient);

      res.setHeader('X-RateLimit-Limit', result.limit.toString());
      res.setHeader('X-RateLimit-Remaining', result.remainingRequests.toString());

      if (result.resetTimestamp !== undefined) {
        res.setHeader('X-RateLimit-Reset', result.resetTimestamp.toString());
      }

      if (result.decision === 'DENY') {
        if (result.retryAfter !== undefined) {
          res.setHeader('Retry-After', result.retryAfter.toString());
        }
        res.status(429).json(result);
      } else {
        res.status(200).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ error: 'In-memory Sliding Log rate limiter error', details: error.message });
    }
  }
  static async processLeakyBucket(req: Request, res: Response) {
    try {
      const apiKey = req.headers['x-api-key'] || req.body.apiKey;

      if (!apiKey || typeof apiKey !== 'string') {
        return res.status(401).json({ error: 'API Key is missing or invalid' });
      }

      const result = await LeakyBucketRateLimiterService.processRequest(apiKey);

      res.set({
        'X-RateLimit-Limit': result.capacity.toString(),
        'X-RateLimit-Remaining': result.queueLength.toString(),
      });

      if (result.decision === 'ALLOW') {
        res.status(200).json(result);
      } else {
        res.status(429).json({ error: 'Too Many Requests', ...result });
      }
    } catch (error: any) {
      if (error.message === 'UNAUTHORIZED') {
        return res.status(401).json({ error: 'Invalid API Key' });
      }
      if (error.message === 'RATE_LIMITER_UNAVAILABLE') {
        return res.status(503).json({ error: 'Rate limiter temporarily unavailable. Please try again.' });
      }
      res.status(500).json({ error: 'Leaky Bucket rate limiter error', details: error.message });
    }
  }

  static async processLeakyBucketMemory(req: Request, res: Response) {
    try {
      let clientId = req.headers['x-client-id'] as string;
      let isRealClient = true;
      if (!clientId) {
        clientId = req.ip || 'unknown-client';
        isRealClient = false;
      }

      const result = await InMemoryLeakyBucketRateLimiterService.processRequest(clientId, isRealClient);

      res.setHeader('X-RateLimit-Limit', result.capacity.toString());
      res.setHeader('X-RateLimit-Remaining', result.queueLength.toString());

      if (result.decision === 'DENY') {
        res.status(429).json(result);
      } else {
        res.status(200).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ error: 'In-memory Leaky Bucket rate limiter error', details: error.message });
    }
  }
}
