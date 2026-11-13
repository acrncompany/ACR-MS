import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PrismaTenantRepository } from './data/prisma-tenant.repository.js';
import { ResolveTenantUseCase } from './domain/resolve-tenant.use-case.js';
import { TenantRepository } from './domain/tenant.repository.js';
import { TenantResolutionMiddleware } from './presentation/tenant-resolution.middleware.js';

@Module({
  providers: [
    { provide: TenantRepository, useClass: PrismaTenantRepository },
    ResolveTenantUseCase,
  ],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantResolutionMiddleware).forRoutes('*path');
  }
}
