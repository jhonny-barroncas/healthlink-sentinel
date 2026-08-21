import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  ZABBIX_CREDENTIALS_ENCRYPTION_KEY: z.string().min(32),
  ZABBIX_API_URL: z.string().url().optional(),
  ZABBIX_API_TOKEN: z.string().min(1).optional(),
  PUBLIC_API_URL: z.string().url().optional(),
  PUBLIC_APP_URL: z.string().url().optional(),
  ZABBIX_SYNC_INTERVAL_MS: z.coerce.number().int().min(10_000).default(60_000),
  ZABBIX_TELEMETRY_INTERVAL_MS: z.coerce.number().int().min(2_000).default(2_000),
});

export const env = schema.parse(process.env);
