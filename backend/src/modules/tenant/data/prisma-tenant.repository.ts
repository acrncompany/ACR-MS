import { Injectable } from '@nestjs/common';
import { SystemPrismaService } from '../../../core/database/system-prisma.service.js';
import { TenantEntity } from '../domain/tenant.entity.js';
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
  constructor(private readonly system: SystemPrismaService) {
    super();
  }

  async findActiveBySlug(slug: string): Promise<TenantEntity | null> {
    const rows = await this.system.client.$queryRaw<TenantLookupRow[]>`
      SELECT id, name, slug, status::text AS status FROM resolve_tenant_by_slug(${slug})`;
    const row = rows[0];
    if (!row || row.status !== 'ACTIVE') return null;
    return { id: row.id, name: row.name, slug: row.slug };
  }
}
