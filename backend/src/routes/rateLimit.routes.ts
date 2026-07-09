import { Router } from 'express';
import { RateLimitController } from '../controllers/rateLimit.controller';

const router = Router();

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

export default router;
