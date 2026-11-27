import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service.js';
import { SystemPrismaService } from '../../../core/database/system-prisma.service.js';
import { SessionPolicy, TenantEntity, TenantProfile } from '../domain/tenant.entity.js';
import { TenantRepository } from '../domain/tenant.repository.js';

interface TenantLookupRow {
  id: string;
  name: string;
  slug: string;
  status: string;
}

/**
 * The tenant has to be found before one is known, and RLS hides every tenants row from
 * acrms_app until app.tenant_id is set. So the lookup goes through the SECURITY DEFINER
 * function resolve_tenant_by_slug, which returns only the fields needed here.
 */
@Injectable()
export class PrismaTenantRepository extends TenantRepository {
  constructor(
    private readonly system: SystemPrismaService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async findCurrentProfile(): Promise<TenantProfile | null> {
    // `tenants` is not auto-scoped; RLS (app.tenant_id) limits it to the current tenant's row.
    const tenant = await this.prisma.client.tenant.findFirst({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        settings: { select: { branding: true, defaultLocale: true } },
      },
    });
    if (!tenant) return null;
    const branding = tenant.settings?.branding;
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      branding:
        branding && typeof branding === 'object' && !Array.isArray(branding) ? branding : {},
      defaultLocale: tenant.settings?.defaultLocale ?? 'en',
    };
  }

  async findCurrentSessionPolicy(): Promise<SessionPolicy> {
    const settings = await this.prisma.client.tenantSettings.findFirst({
      where: { deletedAt: null },
      select: { refreshTokenDays: true, sessionMaxDays: true, idleTimeoutMinutes: true },
    });
    return settings ?? { refreshTokenDays: 7, sessionMaxDays: 30, idleTimeoutMinutes: null };
  }

  async findActiveBySlug(slug: string): Promise<TenantEntity | null> {
    const rows = await this.system.client.$queryRaw<TenantLookupRow[]>`
      SELECT id, name, slug, status::text AS status FROM resolve_tenant_by_slug(${slug})`;
    const row = rows[0];
    if (!row || row.status !== 'ACTIVE') return null;
    return { id: row.id, name: row.name, slug: row.slug };
  }
}
