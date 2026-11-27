import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { ScryptPasswordHasher } from '../../src/modules/auth/data/scrypt-password-hasher.js';

/**
 * Test fixtures written with the OWNER role (it bypasses row-level security), so a spec can build
 * a small company with a reporting hierarchy, roles and permissions without the dev seed.
 */

export const TEST_PASSWORD = 'Correct-Horse-Battery-9!';

export interface Fixture {
  tenantId: string;
  host: string;
  slug: string;
  branchId: string;
  otherBranchId: string;
  departmentId: string;
  roles: Record<'board' | 'manager' | 'lead' | 'member' | 'plain', string>;
  positions: Record<'board' | 'manager' | 'lead' | 'member' | 'plain', string>;
}

const PERMISSIONS = {
  board: 'ALL',
  manager: [
    'dashboard.view',
    'clients.view',
    'clients.create',
    'clients.edit',
    'clients.deactivate',
    'clients.reveal_credentials',
    'users.view',
    'users.create',
    'users.edit',
    'users.deactivate',
    'organization.view',
    'organization.create',
    'organization.edit',
    'roles.view',
  ],
  lead: [
    'clients.view',
    'clients.edit',
    'clients.reveal_credentials',
    'users.view',
    'users.create',
    'users.edit',
    'users.deactivate',
  ],
  member: ['clients.view', 'users.view'],
  plain: ['dashboard.view'],
} as const;

export async function createFixture(
  owner: pg.Pool,
  label: string,
  baseDomain: string,
): Promise<Fixture> {
  const suffix = randomUUID().slice(0, 8);
  const slug = `${label}-${suffix}`;
  const tenantId = randomUUID();
  await owner.query(`INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3)`, [
    tenantId,
    `Test ${slug}`,
    slug,
  ]);
  await owner.query(
    `INSERT INTO tenant_settings ("tenantId", "idleTimeoutMinutes", "sessionMaxDays", "refreshTokenDays")
     VALUES ($1, NULL, 30, 7)`,
    [tenantId],
  );
  const country = (await owner.query<{ id: string }>(`SELECT id FROM countries LIMIT 1`)).rows[0];
  if (!country) throw new Error('Run the dev seed first: no reference countries exist');
  const company = randomUUID();
  await owner.query(
    `INSERT INTO companies (id, "tenantId", name, "countryId", "baseCurrencyCode", "fiscalYearStartMonth", timezone)
     VALUES ($1, $2, 'Test Co', $3, 'INR', 4, 'Asia/Kolkata')`,
    [company, tenantId, country.id],
  );
  const branchId = randomUUID();
  const otherBranchId = randomUUID();
  for (const [id, code] of [
    [branchId, 'MAIN'],
    [otherBranchId, 'OTHER'],
  ] as const) {
    await owner.query(
      `INSERT INTO branches (id, "tenantId", "companyId", code, name, "countryId", timezone)
       VALUES ($1, $2, $3, $4, $4, $5, 'Asia/Kolkata')`,
      [id, tenantId, company, code, country.id],
    );
  }
  const departmentId = randomUUID();
  await owner.query(
    `INSERT INTO org_departments (id, "tenantId", code, name) VALUES ($1, $2, 'OPS', 'Operations')`,
    [departmentId, tenantId],
  );

  const roles = {} as Fixture['roles'];
  for (const key of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) {
    const id = randomUUID();
    roles[key] = id;
    await owner.query(`INSERT INTO roles (id, "tenantId", key, name) VALUES ($1, $2, $3, $3)`, [
      id,
      tenantId,
      key,
    ]);
    const wanted = PERMISSIONS[key];
    await owner.query(
      wanted === 'ALL'
        ? `INSERT INTO role_permissions ("tenantId", "roleId", "permissionId")
           SELECT $1, $2, id FROM permissions`
        : `INSERT INTO role_permissions ("tenantId", "roleId", "permissionId")
           SELECT $1, $2, id FROM permissions WHERE key = ANY($3)`,
      wanted === 'ALL' ? [tenantId, id] : [tenantId, id, [...wanted]],
    );
  }

  const positions = {} as Fixture['positions'];
  const chain: [keyof Fixture['positions'], keyof Fixture['positions'] | null, boolean][] = [
    ['board', null, true],
    ['manager', 'board', false],
    ['lead', 'manager', false],
    ['member', 'lead', false],
    ['plain', 'manager', false],
  ];
  for (const [key, parent, top] of chain) {
    const id = randomUUID();
    positions[key] = id;
    await owner.query(
      `INSERT INTO org_positions (id, "tenantId", "departmentId", "parentPositionId", "roleId", code, name, "seesAll", "allBranches")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
      [
        id,
        tenantId,
        departmentId,
        parent ? positions[parent] : null,
        roles[key],
        key.toUpperCase(),
        `Test ${key}`,
        top,
      ],
    );
  }
  return {
    tenantId,
    host: `${slug}.${baseDomain}`,
    slug,
    branchId,
    otherBranchId,
    departmentId,
    roles,
    positions,
  };
}

export interface FixtureUser {
  id: string;
  email: string;
  employeeCode: string;
}

/** Creates a user the way the API does: code from the tenant sequence, role and branch access. */
export async function createFixtureUser(
  owner: pg.Pool,
  f: Fixture,
  position: keyof Fixture['positions'],
  options: {
    managerId?: string | null;
    name?: string;
    status?: 'ACTIVE' | 'DISABLED';
    password?: string;
  } = {},
): Promise<FixtureUser> {
  const hash = await new ScryptPasswordHasher().hash(options.password ?? TEST_PASSWORD);
  const id = randomUUID();
  const email = `${position}-${randomUUID().slice(0, 8)}@fixture.test`;
  const client = await owner.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [f.tenantId]);
    const code = (
      await client.query<{ value: number }>(`SELECT next_code_value('employee') AS value`)
    ).rows[0]!.value;
    const employeeCode = `EMP-${String(code).padStart(4, '0')}`;
    await client.query(
      `INSERT INTO users (id, "tenantId", email, name, "employeeCode", "passwordHash", status, "positionId", "managerId", "homeBranchId")
       VALUES ($1, $2, $3, $4, $5, $6, $7::"UserStatus", $8, $9, $10)`,
      [
        id,
        f.tenantId,
        email,
        options.name ?? `Test ${position}`,
        employeeCode,
        hash,
        options.status ?? 'ACTIVE',
        f.positions[position],
        options.managerId ?? null,
        f.branchId,
      ],
    );
    await client.query(
      `INSERT INTO user_roles ("tenantId", "userId", "roleId") VALUES ($1, $2, $3)`,
      [f.tenantId, id, f.roles[position]],
    );
    if (position !== 'board') {
      await client.query(
        `INSERT INTO user_branch_access ("tenantId", "userId", "branchId") VALUES ($1, $2, $3)`,
        [f.tenantId, id, f.branchId],
      );
    }
    await client.query('COMMIT');
    return { id, email, employeeCode };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Lookups the client master needs (a subset of what the dev seed creates). */
export async function createClientLookups(owner: pg.Pool, tenantId: string): Promise<void> {
  for (const [index, [key, label]] of [
    ['pvt-co', 'Pvt Co'],
    ['individual', 'Individual'],
  ].entries()) {
    await owner.query(
      `INSERT INTO organisation_types ("tenantId", code, key, label) VALUES ($1, $2, $3, $4)`,
      [tenantId, `ORG-${String(index + 1).padStart(4, '0')}`, key, label],
    );
  }
  for (const [index, key] of ['MCA', 'TDS', 'GST'].entries()) {
    await owner.query(
      `INSERT INTO compliance_laws ("tenantId", code, key, label) VALUES ($1, $2, $3, $3)`,
      [tenantId, `WRK-${String(index + 1).padStart(4, '0')}`, key],
    );
  }
}

export async function deleteFixtures(owner: pg.Pool, tenantIds: string[]): Promise<void> {
  const client = await owner.connect();
  try {
    // audit_logs is append-only; the owner role lifts the trigger just for this cleanup.
    await client.query(`ALTER TABLE audit_logs DISABLE TRIGGER USER`);
    await client.query(`DELETE FROM audit_logs WHERE "tenantId" = ANY($1)`, [tenantIds]);
    await client.query(`ALTER TABLE audit_logs ENABLE TRIGGER USER`);
    for (const table of [
      'employees',
      'designations',
      'departments',
      'client_credentials',
      'client_team',
      'client_laws',
      'client_directors',
      'clients',
      'organisation_types',
      'compliance_laws',
      'sessions',
      'user_branch_access',
      'user_roles',
      'role_permissions',
      'users',
      'org_positions',
      'org_departments',
      'roles',
      'branches',
      'companies',
      'code_sequences',
      'tenant_settings',
    ]) {
      await client.query(`DELETE FROM ${table} WHERE "tenantId" = ANY($1)`, [tenantIds]);
    }
    await client.query(`DELETE FROM tenants WHERE id = ANY($1)`, [tenantIds]);
  } finally {
    client.release();
  }
}
