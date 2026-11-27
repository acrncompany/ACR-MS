import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { AllExceptionsFilter } from './errors/all-exceptions.filter.js';

import { LoggingModule } from './logging/logging.module.js';
import { TenantContextModule } from './tenant/tenant-context.module.js';
import { StorageModule } from './storage/storage.module.js';

@Module({
  imports: [ConfigModule, LoggingModule, TenantContextModule, DatabaseModule, StorageModule],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class CoreModule {}
