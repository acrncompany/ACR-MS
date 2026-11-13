import 'reflect-metadata';
import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { AppConfig } from './core/config/app-config.js';

async function bootstrap(): Promise<void> {
  // AppConfig validates the environment on construction; a bad env aborts startup here.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(AppConfig);

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableCors({ origin: config.get('CORS_ORIGINS') });
  app.enableShutdownHooks();

  await app.listen(config.get('PORT'));
}

bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
