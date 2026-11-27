import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './openapi';

const API_PREFIXES = ['/api/', '/healthz', '/readyz', '/docs', '/docs-json'];

function webRoot(): string {
  return join(__dirname, '..', 'web', 'dist');
}

export function hasWebBundle(): boolean {
  return existsSync(join(webRoot(), 'index.html'));
}

export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  app.setGlobalPrefix('api/v1', { exclude: ['healthz', 'readyz', 'docs', 'docs-json'] });
  app.enableShutdownHooks();
  app.enableCors({ origin: true });

  const document = buildOpenApiDocument(app);
  SwaggerModule.setup('docs', app, document, { useGlobalPrefix: false });

  const root = webRoot();
  if (existsSync(join(root, 'index.html'))) {
    app.useStaticAssets(root, { index: 'index.html' });
    const express = app.getHttpAdapter().getInstance();
    express.use((req: Request, res: Response, next: () => void) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (API_PREFIXES.some((prefix) => req.path === prefix || req.path.startsWith(prefix))) {
        return next();
      }
      if (/\.[a-z0-9]+$/i.test(req.path)) return next();
      res.sendFile(join(root, 'index.html'));
    });
  }

  return app;
}
