import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { AppConfig } from '../config/app-config.js';

/**
 * The one raw PrismaClient in the application. It is NOT exported from DatabaseModule:
 * feature code gets either the tenant-scoped PrismaService or, in tenant/admin modules only,
 * SystemPrismaService.
 *
 * DATABASE_URL must connect as the runtime role (acrms_app). Startup fails when the role is a
 * superuser or has BYPASSRLS, because row-level security would then be silently skipped.
 */
@Injectable()
export class BasePrismaClient extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: AppConfig) {
    super({ adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL') }) });
  }

  async onModuleInit(): Promise<void> {
    const [role] = await this.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    if (!role || role.rolsuper || role.rolbypassrls) {
      throw new Error(
        'DATABASE_URL must use the runtime role acrms_app (no SUPERUSER, no BYPASSRLS). ' +
          'The owner role belongs in MIGRATION_DATABASE_URL only.',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
