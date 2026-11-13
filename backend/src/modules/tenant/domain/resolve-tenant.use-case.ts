import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../core/config/app-config.js';
import { NotFoundError } from '../../../core/errors/app-error.js';
import { TenantEntity } from './tenant.entity.js';
import { TenantRepository } from './tenant.repository.js';

/** Resolves the tenant from the request host (`<slug>.<TENANT_BASE_DOMAIN>`). */
@Injectable()
export class ResolveTenantUseCase {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly config: AppConfig,
  ) {}

  async execute(hostname: string): Promise<TenantEntity> {
    const slug = this.extractSlug(hostname);
    const tenant = slug ? await this.tenants.findActiveBySlug(slug) : null;
    if (!tenant) throw new NotFoundError('Tenant not found');
    return tenant;
  }

  private extractSlug(hostname: string): string | null {
    const suffix = `.${this.config.get('TENANT_BASE_DOMAIN')}`;
    const host = hostname.toLowerCase();
    if (!host.endsWith(suffix)) return null;
    const slug = host.slice(0, -suffix.length);
    return /^[a-z0-9-]+$/.test(slug) ? slug : null;
  }
}
