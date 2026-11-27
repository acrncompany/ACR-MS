import { VersioningType, type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppConfig } from './core/config/app-config.js';

/** HTTP settings shared by the real server and the end-to-end tests. */
export function configureApp(app: INestApplication, config: AppConfig): void {
  const express = app as NestExpressApplication;
  const proxies = config.get('TRUST_PROXY');
  if (proxies > 0) express.set('trust proxy', proxies);

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.use(cookieParser());
  // The refresh cookie only works with credentialed CORS, which needs explicit origins.
  app.enableCors({
    origin: config.get('CORS_ORIGINS'),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });
}
