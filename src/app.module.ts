import { BullModule } from '@nestjs/bullmq';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { CategoriesModule } from './categories/categories.module';
import { HttpExceptionFilter } from './common/errors/http-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { PrismaModule } from './common/prisma/prisma.module';
import { validateEnv } from './config/configuration';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL') ?? 'info',
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const incoming = req.headers['x-request-id'];
            const id =
              typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 128
                ? incoming
                : randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/readyz' },
          transport:
            config.get<string>('NODE_ENV') === 'production'
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' } },
        },
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.get<string>('REDIS_URL') as string);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            username: url.username || undefined,
            password: url.password || undefined,
            db: url.pathname && url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
            maxRetriesPerRequest: null,
            tls: url.protocol === 'rediss:' ? {} : undefined,
          },
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: 60_000,
          limit: Number(config.get<string>('THROTTLE_LIMIT') ?? 100),
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    CartModule,
    JobsModule,
    OrdersModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
