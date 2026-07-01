import { Router } from 'express';
import { RateLimitController } from '../controllers/rateLimit.controller';

const router = Router();

router.post('/', RateLimitController.process);
router.get('/', RateLimitController.process); // Allow GET for easier testing via browser/curl

router.post('/memory', RateLimitController.processMemory);
router.get('/memory', RateLimitController.processMemory);

export default router;
