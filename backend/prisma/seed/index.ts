/**
 * DEV-ONLY seed. Run with `npx prisma db seed` (also runs after `prisma migrate reset`).
 *
 * Connects as the OWNER role (MIGRATION_DATABASE_URL), which bypasses RLS; that is why this
 * script may write rows for a tenant without app.tenant_id. It is not part of the app build.
 *
 * - Global reference data (currencies, geography, permissions) is upserted every run.
 * - The ACR tenant and its org chart are created once; a second run skips them.
 * - Demo user passwords come from SEED_DEMO_PASSWORD. Nothing is hardcoded.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { ScryptPasswordHasher } from '../../src/modules/auth/data/scrypt-password-hasher.js';
import { DEPARTMENTS, PERMISSIONS, POSITIONS, ROLES } from './org-chart.js';
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
  return ids;
}

async function seedTenant(db: PrismaClient, geo: Map<string, string>): Promise<void> {
  const existing = await db.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (existing) {
    console.log(`Tenant "${TENANT_SLUG}" already exists; tenant data not re-seeded.`);
    return;
  }

  const demoPassword = requireEnv('SEED_DEMO_PASSWORD');
  const emailDomain = process.env.SEED_EMAIL_DOMAIN ?? 'acr.test';
  const passwordHash = await new ScryptPasswordHasher().hash(demoPassword);
  const geoId = (key: string): string => {
    const id = geo.get(key);
    if (!id) throw new Error(`Missing reference row ${key}`);
    return id;
  };

  await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { name: 'ACR Company', slug: TENANT_SLUG } });
    const tenantId = tenant.id;

    await tx.tenantSettings.create({
      data: {
        tenantId,
        idleTimeoutMinutes: 30,
        sessionMaxDays: 30,
        refreshTokenDays: 7,
        defaultLocale: 'en-IN',
      },
    });

    const company = await tx.company.create({
      data: {
        tenantId,
        name: 'ACR Company',
        countryId: geoId('country:IN'),
        baseCurrencyCode: 'INR',
        fiscalYearStartMonth: 4,
        timezone: 'Asia/Kolkata',
      },
    });

    const branch = await tx.branch.create({
      data: {
        tenantId,
        companyId: company.id,
        code: 'KOCHI',
        name: 'Kochi',
        countryId: geoId('country:IN'),
        regionId: geoId('region:KL'),
        districtId: geoId('district:Ernakulam'),
        cityId: geoId('city:Kochi'),
        timezone: 'Asia/Kolkata',
      },
    });

    // Roles and their permissions.
    const permissions = await tx.permission.findMany({ select: { id: true, key: true } });
    const roleIds = new Map<string, string>();
    for (const role of ROLES) {
      const row = await tx.role.create({
        data: { tenantId, key: role.key, name: role.name, description: role.description },
      });
      roleIds.set(role.key, row.id);
      const granted = permissions.filter((p) => role.permissions(p.key));
      await tx.rolePermission.createMany({
        data: granted.map((p) => ({ tenantId, roleId: row.id, permissionId: p.id })),
      });
    }

    // Departments (parents listed first).
    const departmentIds = new Map<string, string>();
    for (const dept of DEPARTMENTS) {
      const row = await tx.department.create({
        data: {
          tenantId,
          code: dept.code,
          name: dept.name,
          parentId: dept.parent ? departmentIds.get(dept.parent) : null,
        },
      });
      departmentIds.set(dept.code, row.id);
    }

    // Positions and one demo user per position (parents listed first).
    const positionIds = new Map<string, string>();
    const userIds = new Map<string, string>();
    for (const pos of POSITIONS) {
      const roleId = roleIds.get(pos.role)!;
      const position = await tx.position.create({
        data: {
          tenantId,
          departmentId: departmentIds.get(pos.department)!,
          parentPositionId: pos.parent ? positionIds.get(pos.parent) : null,
          roleId,
          code: pos.code,
          name: pos.name,
          seesAll: pos.seesAll ?? false,
          allBranches: pos.allBranches ?? false,
        },
      });
      positionIds.set(pos.code, position.id);

      const user = await tx.user.create({
        data: {
          tenantId,
          email: `${pos.role.replaceAll('_', '.')}@${emailDomain}`.toLowerCase(),
          name: `Demo ${pos.name}`,
          passwordHash,
          positionId: position.id,
          managerId: pos.parent ? userIds.get(pos.parent) : null,
          homeBranchId: branch.id,
        },
      });
      userIds.set(pos.code, user.id);

      await tx.userRole.create({ data: { tenantId, userId: user.id, roleId } });
      if (!pos.allBranches) {
        await tx.userBranchAccess.create({
          data: { tenantId, userId: user.id, branchId: branch.id },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        tenantId,
        action: 'tenant.seeded',
        entity: 'tenant',
        entityId: tenantId,
        changes: { roles: ROLES.length, positions: POSITIONS.length, users: userIds.size },
      },
    });

    console.log(
      `Seeded tenant "${TENANT_SLUG}" with ${userIds.size} demo users (@${emailDomain}).`,
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
