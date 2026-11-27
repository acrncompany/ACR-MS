import 'reflect-metadata';
import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { AppConfig } from '../src/core/config/app-config.js';
import {
  TEST_PASSWORD,
  createFixture,
  createFixtureUser,
  deleteFixtures,
  type Fixture,
  type FixtureUser,
} from './support/fixtures.js';

/**
 * End-to-end tests of the HR directory (departments, designations, employees) against the real
 * database and HTTP stack: permissions, permanent codes, references, tenant isolation and audit.
 */

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set for the integration tests`);
  return value;
}

const BASE_DOMAIN = process.env.TENANT_BASE_DOMAIN ?? 'localhost';
const owner = new pg.Pool({ connectionString: env('MIGRATION_DATABASE_URL') });

let app: INestApplication;
let A: Fixture;
let B: Fixture;
let board: FixtureUser;
let boardB: FixtureUser;
let plain: FixtureUser;
const tokens = new Map<string, string>();

async function tokenFor(f: Fixture, user: FixtureUser): Promise<string> {
  const cached = tokens.get(user.id);
  if (cached) return cached;
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('Host', f.host)
    .send({ email: user.email, password: TEST_PASSWORD });
  expect(res.status).toBe(200);
  const token = (res.body as { accessToken: string }).accessToken;
  tokens.set(user.id, token);
  return token;
}

async function api(
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  user: FixtureUser,
  body?: unknown,
  f: Fixture = A,
): Promise<request.Response> {
  const req = request(app.getHttpServer())
    [method](`/api/v1${path}`)
    .set('Host', f.host)
    .set('Authorization', `Bearer ${await tokenFor(f, user)}`);
  return body === undefined ? req : req.send(body as object);
}

const q = async <T extends pg.QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> =>
  (await owner.query<T>(sql, params)).rows;

beforeAll(async () => {
  process.env.THROTTLE_LOGIN_LIMIT = '10000';
  process.env.THROTTLE_REFRESH_LIMIT = '10000';
  process.env.THROTTLE_DEFAULT_LIMIT = '10000';
  A = await createFixture(owner, 'hr-a', BASE_DOMAIN);
  B = await createFixture(owner, 'hr-b', BASE_DOMAIN);
  board = await createFixtureUser(owner, A, 'board');
  boardB = await createFixtureUser(owner, B, 'board');
  plain = await createFixtureUser(owner, A, 'plain', { managerId: board.id });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  configureApp(app, app.get(AppConfig));
  await app.init();
});

afterAll(async () => {
  await app.close();
  await deleteFixtures(owner, [A.tenantId, B.tenantId]);
  await owner.end();
});

describe('HR directory', () => {
  let departmentId: string;
  let otherDepartmentId: string;
  let designationId: string;

  it('requires hr.view / hr.create', async () => {
    expect((await api('get', '/hr/departments', plain)).status).toBe(403);
    expect((await api('post', '/hr/departments', plain, { name: 'X' })).status).toBe(403);
    expect((await api('get', '/hr/employees/next-code', plain)).status).toBe(403);
  });

  it('creates departments with permanent, sequential codes and an audit row', async () => {
    const first = await api('post', '/hr/departments', board, { name: 'Finance' });
    expect(first.status).toBe(201);
    expect(first.body.code).toMatch(/^DEP-\d{4}$/);
    expect(first.body.status).toBe('Active');
    departmentId = first.body.id;
    const second = await api('post', '/hr/departments', board, {
      name: 'Audit',
      description: 'Statutory audit',
      status: 'Inactive',
    });
    expect(second.status).toBe(201);
    expect(second.body.status).toBe('Inactive');
    otherDepartmentId = second.body.id;
    expect(Number(second.body.code.slice(4))).toBe(Number(first.body.code.slice(4)) + 1);
    const audit = await q(
      `SELECT 1 FROM audit_logs WHERE "entityId" = $1 AND action = 'hr.department.create'`,
      [departmentId],
    );
    expect(audit).toHaveLength(1);
  });

  it('previews the next code without reserving it', async () => {
    const a = await api('get', '/hr/departments/next-code', board);
    const b = await api('get', '/hr/departments/next-code', board);
    expect(a.status).toBe(200);
    expect(a.body.code).toBe(b.body.code);
    const created = await api('post', '/hr/departments', board, { name: 'Tax' });
    expect(created.body.code).toBe(a.body.code);
  });

  it('rejects a duplicate name, unknown keys and a client-sent code or tenantId', async () => {
    expect((await api('post', '/hr/departments', board, { name: 'Finance' })).status).toBe(409);
    expect(
      (await api('post', '/hr/departments', board, { name: 'N', code: 'DEP-9999' })).status,
    ).toBe(400);
    expect(
      (await api('post', '/hr/departments', board, { name: 'N', tenantId: B.tenantId })).status,
    ).toBe(400);
    expect((await api('post', '/hr/departments', board, { name: '   ' })).status).toBe(400);
  });

  it('creates a designation inside an active department only', async () => {
    const ok = await api('post', '/hr/designations', board, {
      name: 'Accountant',
      departmentId,
    });
    expect(ok.status).toBe(201);
    expect(ok.body.code).toMatch(/^DSG-\d{4}$/);
    expect(ok.body.departmentName).toBe('Finance');
    designationId = ok.body.id;
    // Inactive department, unknown department, missing department.
    expect(
      (await api('post', '/hr/designations', board, { name: 'A', departmentId: otherDepartmentId }))
        .status,
    ).toBe(400);
    expect(
      (
        await api('post', '/hr/designations', board, {
          name: 'A',
          departmentId: '00000000-0000-4000-8000-000000000000',
        })
      ).status,
    ).toBe(400);
    expect((await api('post', '/hr/designations', board, { name: 'A' })).status).toBe(400);
    // Same name in the same department is a conflict.
    expect(
      (await api('post', '/hr/designations', board, { name: 'Accountant', departmentId })).status,
    ).toBe(409);
  });

  it('creates employees; the department follows the designation', async () => {
    const res = await api('post', '/hr/employees', board, {
      name: 'Asha Verma',
      email: 'Asha@Example.com',
      phone: '9847012345',
      designationId,
      joinDate: '2026-04-01',
    });
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^HRE-\d{4}$/);
    expect(res.body.email).toBe('asha@example.com');
    expect(res.body.departmentId).toBe(departmentId);
    expect(res.body.designationName).toBe('Accountant');
    expect(res.body.joinDate).toBe('2026-04-01');
    const bare = await api('post', '/hr/employees', board, {
      name: 'No Links',
      joinDate: '2026-05-02',
    });
    expect(bare.status).toBe(201);
    expect(bare.body.departmentId).toBeNull();
    expect(bare.body.designationId).toBeNull();
  });

  it('rejects an employee whose designation is in another department or has a bad date', async () => {
    const dept2 = await api('post', '/hr/departments', board, { name: 'Payroll' });
    const mismatch = await api('post', '/hr/employees', board, {
      name: 'Mismatch',
      departmentId: dept2.body.id,
      designationId,
      joinDate: '2026-04-01',
    });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.code ?? mismatch.body.error?.code).toBe('DESIGNATION_DEPARTMENT_MISMATCH');
    expect(
      (await api('post', '/hr/employees', board, { name: 'D', joinDate: '01/04/2026' })).status,
    ).toBe(400);
    expect(
      (
        await api('post', '/hr/employees', board, {
          name: 'E',
          email: 'nope',
          joinDate: '2026-04-01',
        })
      ).status,
    ).toBe(400);
  });

  it('lists with search and paging, and offers only active entries as options', async () => {
    const list = await api('get', '/hr/departments?q=fin&page=1&pageSize=10', board);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].name).toBe('Finance');
    const byDept = await api('get', '/hr/designations?q=finance', board);
    expect(byDept.body.total).toBe(1);
    const employees = await api('get', '/hr/employees', board);
    expect(employees.body.total).toBe(2);
    const options = await api('get', '/hr/departments/options', board);
    expect((options.body as { name: string }[]).map((o) => o.name)).not.toContain('Audit');
    const designations = await api('get', '/hr/designations/options', board);
    expect(designations.body[0].departmentId).toBe(departmentId);
  });

  it('keeps tenants apart', async () => {
    const other = await api('get', '/hr/departments', boardB, undefined, B);
    expect(other.status).toBe(200);
    expect(other.body.total).toBe(0);
    // Another tenant's department id is not a valid reference.
    const cross = await api(
      'post',
      '/hr/designations',
      boardB,
      { name: 'Sneaky', departmentId },
      B,
    );
    expect(cross.status).toBe(400);
  });

  it('has RLS and permanent codes in the database', async () => {
    const rls = await q<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname IN ('departments', 'designations', 'employees')`,
    );
    expect(rls).toHaveLength(3);
    expect(rls.every((r) => r.relrowsecurity && r.relforcerowsecurity)).toBe(true);
    await expect(
      q(`UPDATE departments SET code = 'DEP-9999' WHERE id = $1`, [departmentId]),
    ).rejects.toThrow(/permanent/);
  });
});
