import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().optional(),
  ENABLE_RATE_LIMIT_TIMING: z.string().default('false').transform(v => v === 'true'),
  MAX_OCC_ATTEMPTS: z.coerce.number().default(20),
  ADMIN_KEY: z.string().default('secret-admin-key'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
