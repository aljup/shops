import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { AppModule } from '../src/app.module';
import { buildOpenApiDocument } from '../src/openapi';

async function main() {
  process.env.SKIP_JOB_SCHEDULER = 'true';
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1', { exclude: ['healthz', 'readyz', 'docs', 'docs-json'] });
  await app.init();

  const document = buildOpenApiDocument(app);
  const target = join(process.cwd(), 'openapi.yaml');
  writeFileSync(target, stringify(document), 'utf8');
  await app.close();
  process.stdout.write(`OpenAPI contract written to ${target}\n`);
}

void main();
