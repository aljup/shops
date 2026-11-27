import { randomUUID } from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://store:store@localhost:5432/store_test?schema=public';
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/1';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? randomUUID();
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? randomUUID();
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL_DAYS = '30';
process.env.LOG_LEVEL = 'silent';
process.env.PORT = '3010';
process.env.SKIP_JOB_SCHEDULER = 'true';
process.env.THROTTLE_LIMIT = '10000';
process.env.ORDER_RESERVATION_MINUTES = '30';
