import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TenantContext } from '../../../core/tenant/tenant-context.js';
import { ResolveTenantUseCase } from '../domain/resolve-tenant.use-case.js';

const PUBLIC_PATHS = /^\/api\/v\d+\/health(\/|\?|$)/;

/**
 * Resolves the tenant from the host BEFORE any handler (including login) runs, then runs the
 * rest of the request inside that tenant's context.
 */
@Injectable()
export class TenantResolutionMiddleware implements NestMiddleware {
  constructor(
    private readonly resolveTenant: ResolveTenantUseCase,
    private readonly tenantContext: TenantContext,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    if (PUBLIC_PATHS.test(req.originalUrl)) return next();
    try {
      const tenant = await this.resolveTenant.execute(req.hostname);
      this.tenantContext.run(tenant.id, () => next());
    } catch (error) {
      next(error);
    }
  }
}
