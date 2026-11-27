/**
 * DEV-ONLY seed. Run with `npx prisma db seed` (also runs after `prisma migrate reset`).
 *
 * Connects as the OWNER role (MIGRATION_DATABASE_URL), which bypasses RLS; that is why this
 * script may write rows for a tenant without app.tenant_id. It is not part of the app build.
 *
 * - Global reference data (currencies, geography, permissions) is upserted every run.
 * - The ACR tenant, roles, org chart and demo users are upserted, so re-running is safe.
 * - Demo user passwords come from SEED_DEMO_PASSWORD. Nothing is hardcoded.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { formatCode } from '../../src/core/codes/code-sequence.js';
import { ScryptPasswordHasher } from '../../src/modules/auth/data/scrypt-password-hasher.js';
import {
  COMPLIANCE_LAWS,
  DEPARTMENTS,
  ORGANISATION_TYPES,
  PERMISSIONS,
  POSITIONS,
  ROLES,
} from './org-chart.js';
import { CURRENCIES, GEOGRAPHY } from './reference-data.js';

const TENANT_SLUG = 'acr';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the dev seed`);
  return value;
}

async function seedReferenceData(db: PrismaClient): Promise<Map<string, string>> {
  for (const c of CURRENCIES) {
    await db.currency.upsert({ where: { code: c.code }, update: c, create: c });
  }

  const ids = new Map<string, string>();
  for (const country of GEOGRAPHY) {
    const { regions, ...data } = country;
    const row = await db.country.upsert({
      where: { isoCode: data.isoCode },
      update: data,
      create: data,
    });
    ids.set(`country:${data.isoCode}`, row.id);

    for (const region of regions) {
      const { districts, ...regionData } = region;
      const r = await db.region.upsert({
        where: { countryId_code: { countryId: row.id, code: regionData.code } },
        update: regionData,
        create: { ...regionData, countryId: row.id },
      });
      ids.set(`region:${regionData.code}`, r.id);

      for (const district of districts) {
        const d = await db.district.upsert({
          where: { regionId_name: { regionId: r.id, name: district.name } },
          update: {},
          create: { regionId: r.id, name: district.name },
        });
        ids.set(`district:${district.name}`, d.id);

        for (const city of district.cities) {
          const ci = await db.city.upsert({
            where: { districtId_name: { districtId: d.id, name: city } },
            update: {},
            create: { districtId: d.id, name: city },
          });
          ids.set(`city:${city}`, ci.id);
        }
      }
    }
  }

  for (const p of PERMISSIONS) {
    await db.permission.upsert({ where: { key: p.key }, update: p, create: p });
  }
  // The catalogue is the source of truth: drop keys it no longer lists (and their grants).
  const current = PERMISSIONS.map((p) => p.key);
  await db.rolePermission.deleteMany({ where: { permission: { key: { notIn: current } } } });
  await db.permission.deleteMany({ where: { key: { notIn: current } } });
  return ids;
}

type SeedTx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/** Same atomic, per-tenant counter the API uses (next_code_value reads app.tenant_id). */
async function nextEmployeeCode(tx: SeedTx, tenantId: string): Promise<string> {
  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
  const rows = await tx.$queryRaw<{ value: number }[]>`SELECT next_code_value('employee') AS value`;
  return formatCode('employee', rows[0]!.value);
}

async function seedTenant(db: PrismaClient, geo: Map<string, string>): Promise<void> {
  const demoPassword = requireEnv('SEED_DEMO_PASSWORD');
  const emailDomain = process.env.SEED_EMAIL_DOMAIN ?? 'acr.test';
  const passwordHash = await new ScryptPasswordHasher().hash(demoPassword);
  const geoId = (key: string): string => {
    const id = geo.get(key);
    if (!id) throw new Error(`Missing reference row ${key}`);
    return id;
  };

  await db.$transaction(async (tx) => {
    const existed = (await tx.tenant.findUnique({ where: { slug: TENANT_SLUG } })) !== null;
    // Only the name is refreshed: a tenant someone suspended stays suspended.
    const tenant = await tx.tenant.upsert({
      where: { slug: TENANT_SLUG },
      update: { name: 'ACR Company' },
      create: { name: 'ACR Company', slug: TENANT_SLUG },
    });
    const tenantId = tenant.id;

    // ACR has no idle logout (null).
    const settings = {
      idleTimeoutMinutes: null,
      sessionMaxDays: 30,
      refreshTokenDays: 7,
      defaultLocale: 'en-IN',
    };
    await tx.tenantSettings.upsert({
      where: { tenantId },
      update: settings,
      create: { tenantId, ...settings },
    });

    const companyData = {
      name: 'ACR Company',
      countryId: geoId('country:IN'),
      baseCurrencyCode: 'INR',
      fiscalYearStartMonth: 4,
      timezone: 'Asia/Kolkata',
    };
    const companyRow = await tx.company.findFirst({
      where: { tenantId, name: companyData.name, deletedAt: null },
    });
    const company = companyRow
      ? await tx.company.update({ where: { id: companyRow.id }, data: companyData })
      : await tx.company.create({ data: { tenantId, ...companyData } });

    const branchData = {
      companyId: company.id,
      name: 'Kochi',
      countryId: geoId('country:IN'),
      regionId: geoId('region:KL'),
      districtId: geoId('district:Ernakulam'),
      cityId: geoId('city:Kochi'),
      timezone: 'Asia/Kolkata',
    };
    const branchRow = await tx.branch.findFirst({
      where: { tenantId, code: 'KOCHI', deletedAt: null },
    });
    const branch = branchRow
      ? await tx.branch.update({ where: { id: branchRow.id }, data: branchData })
      : await tx.branch.create({ data: { tenantId, code: 'KOCHI', ...branchData } });

    // Roles and their permissions: the grants are made to match the definition exactly.
    const permissions = await tx.permission.findMany({ select: { id: true, key: true } });
    const roleIds = new Map<string, string>();
    for (const role of ROLES) {
      const data = { name: role.name, description: role.description };
      const existing = await tx.role.findFirst({
        where: { tenantId, key: role.key, deletedAt: null },
      });
      const row = existing
        ? await tx.role.update({ where: { id: existing.id }, data })
        : await tx.role.create({ data: { tenantId, key: role.key, ...data } });
      roleIds.set(role.key, row.id);

      const wanted = permissions.filter((p) => role.permissions.has(p.key));
      await tx.rolePermission.deleteMany({
        where: { tenantId, roleId: row.id, permissionId: { notIn: wanted.map((p) => p.id) } },
      });
      await tx.rolePermission.createMany({
        data: wanted.map((p) => ({ tenantId, roleId: row.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }

    // Departments (parents listed first).
    const departmentIds = new Map<string, string>();
    for (const dept of DEPARTMENTS) {
      const data = {
        name: dept.name,
        parentId: dept.parent ? departmentIds.get(dept.parent) : null,
      };
      const existing = await tx.orgDepartment.findFirst({
        where: { tenantId, code: dept.code, deletedAt: null },
      });
      const row = existing
        ? await tx.orgDepartment.update({ where: { id: existing.id }, data })
        : await tx.orgDepartment.create({ data: { tenantId, code: dept.code, ...data } });
      departmentIds.set(dept.code, row.id);
    }

    // Positions and one demo user per position (parents listed first).
    const positionIds = new Map<string, string>();
    const userIds = new Map<string, string>();
    for (const pos of POSITIONS) {
      const roleId = roleIds.get(pos.role)!;
      const positionData = {
        departmentId: departmentIds.get(pos.department)!,
        parentPositionId: pos.parent ? positionIds.get(pos.parent) : null,
        roleId,
        name: pos.name,
        designationCode: pos.designationCode ?? null,
        seesAll: pos.seesAll ?? false,
        allBranches: pos.allBranches ?? false,
      };
      const existingPosition = await tx.orgPosition.findFirst({
        where: { tenantId, code: pos.code, deletedAt: null },
      });
      const position = existingPosition
        ? await tx.orgPosition.update({ where: { id: existingPosition.id }, data: positionData })
        : await tx.orgPosition.create({ data: { tenantId, code: pos.code, ...positionData } });
      positionIds.set(pos.code, position.id);

      const email = `${pos.role.replaceAll('_', '.')}@${emailDomain}`.toLowerCase();
      const userData = {
        name: `Demo ${pos.name}`,
        passwordHash,
        positionId: position.id,
        managerId: pos.parent ? userIds.get(pos.parent) : null,
        homeBranchId: branch.id,
        // Re-seeding also clears a lockout, which is handy while testing login.
        status: 'ACTIVE' as const,
        failedLoginCount: 0,
        lockedUntil: null,
      };
      const existingUser = await tx.user.findFirst({
        where: { tenantId, email, deletedAt: null },
      });
      // An existing user keeps their code (it is permanent). A new one gets the next code from the
      // tenant's sequence, exactly like the API does.
      const user = existingUser
        ? await tx.user.update({ where: { id: existingUser.id }, data: userData })
        : await tx.user.create({
            data: {
              tenantId,
              email,
              employeeCode: await nextEmployeeCode(tx, tenantId),
              ...userData,
            },
          });
      userIds.set(pos.code, user.id);

      await tx.userRole.deleteMany({
        where: { tenantId, userId: user.id, roleId: { not: roleId } },
      });
      await tx.userRole.createMany({
        data: [{ tenantId, userId: user.id, roleId }],
        skipDuplicates: true,
      });
      if (pos.allBranches) {
        await tx.userBranchAccess.deleteMany({ where: { tenantId, userId: user.id } });
      } else {
        await tx.userBranchAccess.createMany({
          data: [{ tenantId, userId: user.id, branchId: branch.id }],
          skipDuplicates: true,
        });
      }
    }

    // Lookups for the client master (no clients are seeded).
    for (const [index, type] of ORGANISATION_TYPES.entries()) {
      const data = { label: type.label, sortOrder: index };
      const existing = await tx.organisationType.findFirst({
        where: { tenantId, key: type.key, deletedAt: null },
      });
      if (existing) await tx.organisationType.update({ where: { id: existing.id }, data });
      else {
        // Same atomic counter the API uses (next_code_value): seeded and created codes never clash.
        const rows = await tx.$queryRaw<
          { value: number }[]
        >`SELECT next_code_value('organisationType') AS value`;
        const code = `ORG-${String(rows[0].value).padStart(4, '0')}`;
        await tx.organisationType.create({ data: { tenantId, key: type.key, code, ...data } });
      }
    }
    for (const [index, law] of COMPLIANCE_LAWS.entries()) {
      const data = { label: law.label, sortOrder: index };
      const existing = await tx.complianceLaw.findFirst({
        where: { tenantId, key: law.key, deletedAt: null },
      });
      if (existing) await tx.complianceLaw.update({ where: { id: existing.id }, data });
      else {
        const rows = await tx.$queryRaw<
          { value: number }[]
        >`SELECT next_code_value('work') AS value`;
        const code = `WRK-${String(rows[0].value).padStart(4, '0')}`;
        await tx.complianceLaw.create({ data: { tenantId, key: law.key, code, ...data } });
      }
    }

    if (!existed) {
      await tx.auditLog.create({
        data: {
          tenantId,
          action: 'tenant.seeded',
          entity: 'tenant',
          entityId: tenantId,
          changes: { roles: ROLES.length, positions: POSITIONS.length, users: userIds.size },
        },
      });
    }

    console.log(
      `${existed ? 'Updated' : 'Seeded'} tenant "${TENANT_SLUG}" with ${userIds.size} demo users (@${emailDomain}).`,
    );
  });
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The seed is for development only and refuses to run in production.');
  }
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireEnv('MIGRATION_DATABASE_URL') }),
  });
  try {
    const geo = await seedReferenceData(db);
    await seedTenant(db, geo);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
