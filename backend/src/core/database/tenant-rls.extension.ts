import { Prisma } from '../../generated/prisma/client.js';
import { TenantContext } from '../tenant/tenant-context.js';

/**
 * Row-level security driver. Runs every model query in a short transaction that first sets
 * `app.tenant_id` for that transaction only (`set_config(..., true)` = `SET LOCAL`), so the
 * PostgreSQL policies on every tenant table see the current tenant. The setting dies with the
 * transaction, which keeps pooled connections clean.
 *
 * Throws (via TenantContext) when no tenant is in context.
 */
export function tenantRlsExtension(tenantContext: TenantContext) {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: 'tenant-rls',
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            const tenantId = tenantContext.getTenantId();
            const [, result] = await client.$transaction([
              client.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
              query(args),
            ]);
            return result;
          },
        },
      },
    }),
  );
}
