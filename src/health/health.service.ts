import { HttpStatus, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.redis = new Redis(config.get<string>('REDIS_URL') as string, {
      maxRetriesPerRequest: 1,
      lazyConnect: false,
    });
    this.redis.on('error', () => undefined);
  }

  liveness() {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  async readiness() {
    const checks: Record<string, 'ok' | 'error'> = { database: 'ok', redis: 'ok' };
    let failed = false;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      checks.database = 'error';
      failed = true;
    }

    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        throw new Error('Unexpected ping reply');
      }
    } catch {
      checks.redis = 'error';
      failed = true;
    }

    if (failed) {
      throw new AppException(
        'NOT_READY',
        'One or more dependencies are unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
        Object.entries(checks)
          .filter(([, value]) => value === 'error')
          .map(([name]) => ({ field: name, message: `${name} check failed` })),
      );
    }

    return { status: 'ok', checks };
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
