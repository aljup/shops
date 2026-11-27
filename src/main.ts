import { Logger } from '@nestjs/common';
import { createApp, hasWebBundle } from './app.factory';

async function bootstrap() {
  const app = await createApp();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(
    `store-api listening on http://0.0.0.0:${port} (storefront at /, docs at /docs${hasWebBundle() ? '' : ' — web/dist missing, run npm run build:web'})`,
    'Bootstrap',
  );
}

void bootstrap();
