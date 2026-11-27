import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './openapi';

const API_PREFIXES = ['/api/', '/healthz', '/readyz', '/docs', '/docs-json'];

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  app.setGlobalPrefix('api/v1', { exclude: ['healthz', 'readyz', 'docs', 'docs-json'] });
  app.enableShutdownHooks();
  app.enableCors({ origin: true });

  const document = buildOpenApiDocument(app);
  SwaggerModule.setup('docs', app, document, { useGlobalPrefix: false });

  const webRoot = join(__dirname, '..', 'web', 'dist');
  const hasWeb = existsSync(join(webRoot, 'index.html'));
  if (hasWeb) {
    app.useStaticAssets(webRoot, { index: 'index.html' });
    const express = app.getHttpAdapter().getInstance();
    express.use((req: Request, res: Response, next: () => void) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (API_PREFIXES.some((prefix) => req.path === prefix || req.path.startsWith(prefix))) {
        return next();
      }
      if (/\.[a-z0-9]+$/i.test(req.path)) return next();
      res.sendFile(join(webRoot, 'index.html'));
    });
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(
    `store-api listening on http://0.0.0.0:${port} (storefront at /, docs at /docs${hasWeb ? '' : ' — web/dist missing, run npm run build:web'})`,
    'Bootstrap',
  );
}

void bootstrap();
