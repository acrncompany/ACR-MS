import { Prisma } from '../../generated/prisma/client.js';
import { TenantContext } from '../tenant/tenant-context.js';

/**
 * Models that are NOT tenant-scoped: the tenant root itself and the global reference tables
 * (geography, currencies, permission catalogue). Every other model has tenantId.
 */
const UNSCOPED_MODELS = new Set<string>([
  Prisma.ModelName.Tenant,
  Prisma.ModelName.Currency,
  Prisma.ModelName.Country,
  Prisma.ModelName.Region,
  Prisma.ModelName.District,
  Prisma.ModelName.City,
  Prisma.ModelName.Permission,
]);

const WHERE_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
]);

type Args = Record<string, unknown> & {
  where?: Record<string, unknown>;
  data?: unknown;
  create?: Record<string, unknown>;
};

/**
 * Prisma Client Extension that forces every query on a tenant-scoped model to carry the
 * current tenantId. Any tenantId a caller passes is overwritten. Throws when there is no
 * tenant in context, so an unscoped query cannot happen by accident.
 */
export function tenantScopeExtension(tenantContext: TenantContext) {
  return Prisma.defineExtension({
    name: 'tenant-scope',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (UNSCOPED_MODELS.has(model)) return query(args);

          const tenantId = tenantContext.getTenantId();
          const scoped = { ...(args as Args) };

          if (WHERE_OPERATIONS.has(operation)) {
            scoped.where = { ...scoped.where, tenantId };
          }

          switch (operation) {
            case 'create':
              scoped.data = { ...(scoped.data as object), tenantId };
              break;
            case 'createMany':
            case 'createManyAndReturn': {
              const rows = scoped.data;
              scoped.data = Array.isArray(rows)
                ? rows.map((row: object) => ({ ...row, tenantId }))
                : { ...(rows as object), tenantId };
              break;
            }
            case 'upsert':
              scoped.where = { ...scoped.where, tenantId };
              scoped.create = { ...scoped.create, tenantId };
              break;
          }

          return query(scoped as typeof args);
        },
      },
    },
  });
}
