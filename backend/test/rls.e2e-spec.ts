import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppConfig } from '../src/core/config/app-config.js';
import { BasePrismaClient } from '../src/core/database/base-prisma-client.js';
import { PrismaService } from '../src/core/database/prisma.service.js';
import { TenantContext } from '../src/core/tenant/tenant-context.js';

/**
 * Proves row-level security isolates tenants at the DATABASE level: the runtime role
 * acrms_app cannot read or write another tenant's rows, even with hand-written SQL that asks
 * for them explicitly.
 */

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set for the RLS integration test`);
  return value;
}

const owner = new pg.Pool({ connectionString: env('MIGRATION_DATABASE_URL') });
const app = new pg.Pool({ connectionString: env('DATABASE_URL') });

const suffix = randomUUID().slice(0, 8);
const tenantA = { id: randomUUID(), slug: `rls-a-${suffix}` };
const tenantB = { id: randomUUID(), slug: `rls-b-${suffix}` };
const userA = randomUUID();
const userB = randomUUID();
const roleB = randomUUID();

/** Runs `sql` as acrms_app inside a transaction with app.tenant_id set (or not set). */
async function asApp<T extends pg.QueryResultRow>(
  tenantId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  const client = await app.connect();
  try {
    await client.query('BEGIN');
    if (tenantId) await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
    const result = await client.query<T>(sql, params);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

beforeAll(async () => {
  // The owner role bypasses RLS, so it can create fixtures for both tenants.
  for (const t of [tenantA, tenantB]) {
    await owner.query(`INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3)`, [
      t.id,
      t.slug,
      t.slug,
    ]);
  }
  await owner.query(
    `INSERT INTO users (id, "tenantId", email, name, "employeeCode", "passwordHash")
     VALUES ($1, $2, 'a@rls.test', 'A', 'EMP-0001', 'x'), ($3, $4, 'b@rls.test', 'B', 'EMP-0001', 'x')`,
    [userA, tenantA.id, userB, tenantB.id],
  );
  await owner.query(
    `INSERT INTO roles (id, "tenantId", key, name) VALUES ($1, $2, 'rls_role', 'RLS role')`,
    [roleB, tenantB.id],
  );
});

afterAll(async () => {
  const ids = [tenantA.id, tenantB.id];
  await owner.query(`DELETE FROM user_roles WHERE "tenantId" = ANY($1)`, [ids]);
  await owner.query(`DELETE FROM roles WHERE "tenantId" = ANY($1)`, [ids]);
  await owner.query(`DELETE FROM users WHERE "tenantId" = ANY($1)`, [ids]);
  await owner.query(`DELETE FROM tenants WHERE id = ANY($1)`, [ids]);
  await Promise.all([owner.end(), app.end()]);
});

describe('row-level security (raw SQL as acrms_app)', () => {
  it('runs as a role that is not superuser and has no BYPASSRLS', async () => {
    const { rows } = await app.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`,
    );
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it("returns only tenant A's rows from an unfiltered SELECT", async () => {
    const { rows } = await asApp<{ id: string; tenantId: string }>(
      tenantA.id,
      `SELECT id, "tenantId" FROM users`,
    );
    expect(rows.map((r) => r.id)).toContain(userA);
    expect(rows.map((r) => r.id)).not.toContain(userB);
    expect(rows.every((r) => r.tenantId === tenantA.id)).toBe(true);
  });

  it("cannot read tenant B's rows even when asking for them explicitly", async () => {
    const byTenant = await asApp(tenantA.id, `SELECT * FROM users WHERE "tenantId" = $1`, [
      tenantB.id,
    ]);
    const byId = await asApp(tenantA.id, `SELECT * FROM users WHERE id = $1`, [userB]);
    const tenantRow = await asApp(tenantA.id, `SELECT * FROM tenants WHERE id = $1`, [tenantB.id]);
    expect(byTenant.rowCount).toBe(0);
    expect(byId.rowCount).toBe(0);
    expect(tenantRow.rowCount).toBe(0);
  });

  it('returns nothing when app.tenant_id is not set (fails closed)', async () => {
    const users = await asApp(null, `SELECT * FROM users WHERE id = ANY($1)`, [[userA, userB]]);
    const tenants = await asApp(null, `SELECT * FROM tenants WHERE id = ANY($1)`, [
      [tenantA.id, tenantB.id],
    ]);
    expect(users.rowCount).toBe(0);
    expect(tenants.rowCount).toBe(0);
  });

  it('cannot insert a row into tenant B while acting as tenant A', async () => {
    await expect(
      asApp(
        tenantA.id,
        `INSERT INTO users ("tenantId", email, name, "employeeCode", "passwordHash") VALUES ($1, 'x@rls.test', 'X', 'EMP-0002', 'x')`,
        [tenantB.id],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("cannot update or delete tenant B's rows", async () => {
    const updated = await asApp(tenantA.id, `UPDATE users SET name = 'hacked' WHERE id = $1`, [
      userB,
    ]);
    const deleted = await asApp(tenantA.id, `DELETE FROM users WHERE id = $1`, [userB]);
    expect(updated.rowCount).toBe(0);
    expect(deleted.rowCount).toBe(0);
    const { rows } = await owner.query(`SELECT name FROM users WHERE id = $1`, [userB]);
    expect(rows[0].name).toBe('B');
  });

  it('resolves a tenant by slug before login through the SECURITY DEFINER function only', async () => {
    const { rows } = await asApp<{ id: string }>(
      null,
      `SELECT id FROM resolve_tenant_by_slug($1)`,
      [tenantB.slug],
    );
    expect(rows).toEqual([{ id: tenantB.id }]);
  });

  it('blocks UPDATE and DELETE on audit_logs for the runtime role', async () => {
    await expect(asApp(tenantA.id, `UPDATE audit_logs SET action = 'x'`)).rejects.toThrow(
      /permission denied/,
    );
    await expect(asApp(tenantA.id, `DELETE FROM audit_logs`)).rejects.toThrow(/permission denied/);
  });
});

describe('composite tenant foreign keys', () => {
  it("rejects a row that points at another tenant's row, even for the owner role", async () => {
    await expect(
      owner.query(`INSERT INTO user_roles ("tenantId", "userId", "roleId") VALUES ($1, $2, $3)`, [
        tenantA.id,
        userA,
        roleB,
      ]),
    ).rejects.toThrow(/foreign key/);
  });
});

describe('PrismaService (tenant-aware client)', () => {
  const config = { get: () => env('DATABASE_URL') } as unknown as AppConfig;
  const base = new BasePrismaClient(config);
  const tenantContext = new TenantContext();
  const prisma = new PrismaService(base, tenantContext);

  beforeAll(() => base.onModuleInit());
  afterAll(() => base.$disconnect());

  it("sees only the current tenant's users", async () => {
    const ids = await tenantContext.run(tenantA.id, async () =>
      (await prisma.client.user.findMany({ select: { id: true } })).map((u) => u.id),
    );
    expect(ids).toContain(userA);
    expect(ids).not.toContain(userB);
  });

  it('returns nothing for a raw query for tenant B inside tx() as tenant A', async () => {
    const rows = await tenantContext.run(tenantA.id, () =>
      prisma.tx(
        (tx) => tx.$queryRaw<{ id: string }[]>`SELECT id FROM users WHERE id = ${userB}::uuid`,
      ),
    );
    expect(rows).toEqual([]);
  });

  it('refuses to start when DATABASE_URL is the owner role', async () => {
    const ownerConfig = { get: () => env('MIGRATION_DATABASE_URL') } as unknown as AppConfig;
    const ownerBase = new BasePrismaClient(ownerConfig);
    await expect(ownerBase.onModuleInit()).rejects.toThrow(/acrms_app/);
    await ownerBase.$disconnect();
  });
});
