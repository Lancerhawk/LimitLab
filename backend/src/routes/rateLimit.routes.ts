import { Router } from 'express';
import { RateLimitController } from '../controllers/rateLimit.controller';
import rateLimit from 'express-rate-limit';

const router = Router();

const sandboxLimiter = rateLimit({
  windowMs: 1000, 
  max: 500, 
  message: {
    error: 'Testing Ceiling Reached',
    message: 'Sandbox burst rate limit exceeded (500 req/sec). Please slow down your load tests.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const sustainedSandboxLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3000, // Limit each IP to 3,000 sandbox requests per window
  message: {
    error: 'Sustained Sandbox Limit Reached',
    message: 'You have made too many sandbox test requests (3000 req/15min). Please take a break and try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(sandboxLimiter);
router.use(sustainedSandboxLimiter);

router.post('/', RateLimitController.process);
router.get('/', RateLimitController.process);

router.post('/memory', RateLimitController.processMemory);
router.get('/memory', RateLimitController.processMemory);

router.post('/fixed-window', RateLimitController.processFixedWindow);
router.get('/fixed-window', RateLimitController.processFixedWindow);

router.post('/fixed-window/memory', RateLimitController.processFixedWindowMemory);
router.get('/fixed-window/memory', RateLimitController.processFixedWindowMemory);

router.post('/sliding-window', RateLimitController.processSlidingWindow);
router.get('/sliding-window', RateLimitController.processSlidingWindow);

router.post('/sliding-window/memory', RateLimitController.processSlidingWindowMemory);
router.get('/sliding-window/memory', RateLimitController.processSlidingWindowMemory);

router.post('/sliding-log', RateLimitController.processSlidingLog);
router.get('/sliding-log', RateLimitController.processSlidingLog);

router.post('/sliding-log/memory', RateLimitController.processSlidingLogMemory);
router.get('/sliding-log/memory', RateLimitController.processSlidingLogMemory);

router.post('/leaky-bucket', RateLimitController.processLeakyBucket);
router.get('/leaky-bucket', RateLimitController.processLeakyBucket);

router.post('/leaky-bucket/memory', RateLimitController.processLeakyBucketMemory);
router.get('/leaky-bucket/memory', RateLimitController.processLeakyBucketMemory);

export default router;
