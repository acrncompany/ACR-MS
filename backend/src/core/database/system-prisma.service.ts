import { Injectable } from '@nestjs/common';
import { BasePrismaClient } from './base-prisma-client.js';

/**
 * Database access with NO tenant context. Deliberately named and rare.
 *
 * It still connects as acrms_app, so row-level security applies: without app.tenant_id set,
 * tenant tables return nothing. Cross-tenant reads go only through SECURITY DEFINER functions
 * created by migrations (e.g. resolve_tenant_by_slug).
 *
 * Allowed only in the tenant module (resolving a tenant before one is known) and future
 * admin/system modules. Business modules must use PrismaService instead.
 */
@Injectable()
export class SystemPrismaService {
  readonly client: BasePrismaClient;

  constructor(base: BasePrismaClient) {
    this.client = base;
  }
}
