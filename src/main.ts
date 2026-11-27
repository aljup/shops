import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './openapi';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  app.setGlobalPrefix('api/v1', { exclude: ['healthz', 'readyz', 'docs', 'docs-json'] });
  app.enableShutdownHooks();
  app.enableCors({ origin: true });

  const document = buildOpenApiDocument(app);
  SwaggerModule.setup('docs', app, document, { useGlobalPrefix: false });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`store-api listening on http://0.0.0.0:${port} (docs at /docs)`, 'Bootstrap');
}

void bootstrap();
