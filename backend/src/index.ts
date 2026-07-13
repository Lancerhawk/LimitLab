import express from 'express';
import { createServer } from 'http';

import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './config/logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const app = express();
const httpServer = createServer(app);

app.set('trust proxy', 1);

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  morgan('dev', {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  })
);



import clientRoutes from './routes/client.routes';
import rateLimitRoutes from './routes/rateLimit.routes';
import dashboardRoutes from './routes/dashboard.routes';

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too Many Requests',
    message: 'Global rate limit exceeded (100 req/15min). Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/v1/rate-limit', cors(), rateLimitRoutes);

const strictCors = cors({ origin: env.CORS_ORIGIN, credentials: true });

app.use('/api/', strictCors, globalLimiter);
app.use('/api/v1/clients', strictCors, clientRoutes);
app.use('/api/v1/stats/dashboard', strictCors, dashboardRoutes);

httpServer.listen(env.PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${env.PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
});
