export interface AppConfig {
  nodeEnv: string;
  port: number;
  logLevel: string;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  accessTtl: string;
  refreshTtlDays: number;
  currency: string;
  reservationMinutes: number;
}

const REQUIRED = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;

export function validateEnv(raw: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED.filter((key) => {
    const value = raw[key];
    return typeof value !== 'string' || value.trim().length === 0;
  });
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const port = Number(raw.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const refreshTtlDays = Number(raw.JWT_REFRESH_TTL_DAYS ?? 30);
  if (!Number.isInteger(refreshTtlDays) || refreshTtlDays < 1) {
    throw new Error('JWT_REFRESH_TTL_DAYS must be a positive integer');
  }

  const reservationMinutes = Number(raw.ORDER_RESERVATION_MINUTES ?? 30);
  if (!Number.isInteger(reservationMinutes) || reservationMinutes < 1) {
    throw new Error('ORDER_RESERVATION_MINUTES must be a positive integer');
  }

  return {
    ...raw,
    PORT: port,
    JWT_REFRESH_TTL_DAYS: refreshTtlDays,
    ORDER_RESERVATION_MINUTES: reservationMinutes,
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: Number(env.PORT ?? 3000),
    logLevel: env.LOG_LEVEL ?? 'info',
    databaseUrl: env.DATABASE_URL as string,
    redisUrl: env.REDIS_URL as string,
    jwtSecret: env.JWT_SECRET as string,
    jwtRefreshSecret: env.JWT_REFRESH_SECRET as string,
    accessTtl: env.JWT_ACCESS_TTL ?? '15m',
    refreshTtlDays: Number(env.JWT_REFRESH_TTL_DAYS ?? 30),
    currency: env.CURRENCY ?? 'SAR',
    reservationMinutes: Number(env.ORDER_RESERVATION_MINUTES ?? 30),
  };
}

export const configuration = () => loadConfig();
