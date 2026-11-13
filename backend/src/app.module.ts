import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { TenantModule } from './modules/tenant/tenant.module.js';
import { UserModule } from './modules/user/user.module.js';

@Module({
  imports: [CoreModule, HealthModule, TenantModule, UserModule, AuthModule],
})
export class AppModule {}
