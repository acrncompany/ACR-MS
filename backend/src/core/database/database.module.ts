import { Global, Module } from '@nestjs/common';
import { TenantContextModule } from '../tenant/tenant-context.module.js';
import { BasePrismaClient } from './base-prisma-client.js';
import { PrismaService } from './prisma.service.js';
import { SystemPrismaService } from './system-prisma.service.js';

@Global()
@Module({
  imports: [TenantContextModule],
  providers: [BasePrismaClient, PrismaService, SystemPrismaService],
  exports: [PrismaService, SystemPrismaService],
})
export class DatabaseModule {}
