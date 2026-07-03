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

export default router;
