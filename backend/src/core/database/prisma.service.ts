import { Injectable } from '@nestjs/common';
import { TenantContext } from '../tenant/tenant-context.js';
import { BasePrismaClient } from './base-prisma-client.js';
import { tenantRlsExtension } from './tenant-rls.extension.js';
import { tenantScopeExtension } from './tenant-scope.extension.js';

function createScopedClient(base: BasePrismaClient, tenantContext: TenantContext) {
  return base.$extends(tenantScopeExtension(tenantContext));
}

type ScopedClient = ReturnType<typeof createScopedClient>;

/** Client handed to `PrismaService.tx` callbacks: tenant-scoped, RLS set for the transaction. */
export type TenantTransaction = Parameters<Parameters<ScopedClient['$transaction']>[0]>[0];

/**
 * The only database access for business modules. Two layers protect tenant data:
 * 1. the tenant-scope extension adds the current tenantId to every query and write;
 * 2. PostgreSQL row-level security, driven by `app.tenant_id`, which this service sets
 *    with SET LOCAL inside every transaction.
 *
 * Use `client` for single queries. Use `tx(fn)` for several statements that must be atomic;
 * do NOT call `client.$transaction(...)` (its queries would each open their own transaction).
 * Raw queries are only safe inside `tx`, where app.tenant_id is set; outside it RLS returns
 * no rows.
 */
@Injectable()
export class PrismaService {
  readonly client;
  private readonly scoped: ScopedClient;

  constructor(
    base: BasePrismaClient,
    private readonly tenantContext: TenantContext,
  ) {
    this.scoped = createScopedClient(base, tenantContext);
    this.client = this.scoped.$extends(tenantRlsExtension(tenantContext));
  }

  /** Runs `fn` in one interactive transaction with app.tenant_id set for the current tenant. */
  tx<T>(
    fn: (tx: TenantTransaction) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<T> {
    const tenantId = this.tenantContext.getTenantId();
    return this.scoped.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    }, options);
  }
}
