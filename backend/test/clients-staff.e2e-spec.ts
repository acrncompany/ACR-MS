import 'reflect-metadata';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { AppConfig } from '../src/core/config/app-config.js';
import { LOG_STREAM } from '../src/core/logging/logging.module.js';
import { CSRF_HEADER_VALUE } from '../src/modules/auth/presentation/auth-http.js';
import {
  TEST_PASSWORD,
  createClientLookups,
  createFixture,
  createFixtureUser,
  deleteFixtures,
  type Fixture,
  type FixtureUser,
} from './support/fixtures.js';

/**
 * End-to-end tests of the client master, staff, organization and credentials against the real
 * database and HTTP stack: permissions, hierarchy visibility, atomic codes, audit rows, the
 * encrypted credentials and the temporary-password flow.
 */

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set for the integration tests`);
  return value;
}

const BASE_DOMAIN = process.env.TENANT_BASE_DOMAIN ?? 'localhost';
const COOKIE = process.env.REFRESH_COOKIE_NAME ?? 'acrms_rt';
const owner = new pg.Pool({ connectionString: env('MIGRATION_DATABASE_URL') });
const SECRET = 'Plant-Secret-7c1e-QZ';

let app: INestApplication;
let A: Fixture;
let B: Fixture;
let board: FixtureUser;
let manager: FixtureUser;
let lead: FixtureUser;
let lead2: FixtureUser;
let member: FixtureUser;
let member2: FixtureUser;
let plain: FixtureUser;
const tokens = new Map<string, string>();

/** Everything the app under test writes to its request log. */
const logs: string[] = [];

async function createApp(): Promise<INestApplication> {
  const logStream = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      logs.push(chunk.toString());
      callback();
    },
  });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(LOG_STREAM)
    .useValue(logStream)
    .compile();
  const created = moduleRef.createNestApplication();
  configureApp(created, created.get(AppConfig));
  await created.init();
  return created;
}

async function login(f: Fixture, email: string, password = TEST_PASSWORD) {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('Host', f.host)
    .send({ email, password });
  const setCookie = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  const cookie = setCookie.find((c) => c.startsWith(`${COOKIE}=`))?.split(';')[0] ?? '';
  return { status: res.status, body: res.body as Record<string, unknown>, cookie };
}

async function tokenFor(f: Fixture, user: FixtureUser): Promise<string> {
  const cached = tokens.get(user.id);
  if (cached) return cached;
  const res = await login(f, user.email);
  expect(res.status).toBe(200);
  const token = res.body.accessToken as string;
  tokens.set(user.id, token);
  return token;
}

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
async function api(
  method: Method,
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

let panCounter = 0;
function uniquePan(): string {
  const n = ++panCounter;
  const letters = (i: number) =>
    String.fromCharCode(65 + ((i * 7 + n) % 26)) + String.fromCharCode(65 + ((i * 3 + n * 5) % 26));
  return `${letters(1)}${letters(2)}C${String(1000 + n).padStart(4, '0')}${String.fromCharCode(65 + (n % 26))}`;
}
/** A well-formed GSTIN for `pan`; the format only (the API does not verify the checksum). */
const gstinFor = (pan: string): string => `32${pan}1Z5`;

function clientBody(overrides: Record<string, unknown> = {}) {
  const pan = uniquePan();
  return {
    name: `Client ${pan}`,
    address: '1 Test Road, Kochi',
    city: 'Kochi',
    email: 'accounts@client.test',
    phone: '9847012345',
    organisationType: 'pvt-co',
    cinFrn: 'U12345KL2020PTC123456',
    incorporationDate: '2020-03-05',
    pan,
    gstin: gstinFor(pan),
    directors: [
      {
        name: 'Asha Verma',
        din: '01234567',
        phone: '9847000222',
        email: 'asha@client.test',
        kycStatus: 'done',
      },
      { name: 'Ravi Verma', din: '', phone: '', email: '', kycStatus: 'pending' },
    ],
    lawKeys: ['MCA', 'GST'],
    teamIds: [],
    ...overrides,
  };
}

beforeAll(async () => {
  process.env.THROTTLE_LOGIN_LIMIT = '10000';
  process.env.THROTTLE_REFRESH_LIMIT = '10000';
  process.env.THROTTLE_DEFAULT_LIMIT = '10000';
  A = await createFixture(owner, 'cs-a', BASE_DOMAIN);
  B = await createFixture(owner, 'cs-b', BASE_DOMAIN);
  for (const f of [A, B]) await createClientLookups(owner, f.tenantId);
  board = await createFixtureUser(owner, A, 'board');
  manager = await createFixtureUser(owner, A, 'manager', { managerId: board.id });
  lead = await createFixtureUser(owner, A, 'lead', { managerId: manager.id });
  lead2 = await createFixtureUser(owner, A, 'lead', { managerId: manager.id });
  member = await createFixtureUser(owner, A, 'member', { managerId: lead.id });
  member2 = await createFixtureUser(owner, A, 'member', { managerId: lead2.id });
  plain = await createFixtureUser(owner, A, 'plain', { managerId: manager.id });
  app = await createApp();
});

afterAll(async () => {
  await app.close();
  await deleteFixtures(owner, [A.tenantId, B.tenantId]);
  await owner.end();
});

describe('clients', () => {
  it('creates a client with directors, laws and a permanent code, and never returns credentials', async () => {
    const res = await api('post', '/clients', manager, clientBody());
    expect(res.status).toBe(201);
    const body = res.body as Record<string, any>;
    expect(body.clientCode).toMatch(/^CLI-\d{4}$/);
    expect(body.organisationTypeLabel).toBe('Pvt Co');
    expect(body.directors).toHaveLength(2);
    expect(body.directors[1].din).toBeNull();
    expect(body.lawKeys).toEqual(['GST', 'MCA']);
    expect(body.active).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/credential|password|ciphertext/i);
    const audit = await q(
      `SELECT changes FROM audit_logs WHERE "entityId" = $1 AND action = 'client.create'`,
      [body.id],
    );
    expect(audit).toHaveLength(1);
  });

  it('validates PAN, GSTIN, CIN/FRN, DIN, dates and email on the server', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ pan: 'BAD' }, 'pan'],
      [{ gstin: '32ABCDE1234F1Z5' }, 'gstin'], // does not contain the PAN
      [{ cinFrn: 'NOT-A-CIN' }, 'cinFrn'],
      [{ incorporationDate: '2999-01-01' }, 'incorporationDate'],
      [{ incorporationDate: '31/02/2020' }, 'incorporationDate'],
      [{ email: 'nope' }, 'email'],
      [{ directors: [{ name: 'X', din: '123', kycStatus: 'done' }] }, 'directors.0.din'],
      [{ name: '   ' }, 'name'],
    ];
    for (const [override, path] of cases) {
      const res = await api('post', '/clients', manager, clientBody(override));
      expect(res.status, JSON.stringify(override)).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(JSON.stringify(res.body.details)).toContain(path);
    }
  });

  it('rejects unknown fields such as clientCode, id and tenantId', async () => {
    for (const extra of [
      { clientCode: 'CLI-9999' },
      { id: randomUUID() },
      { tenantId: B.tenantId },
    ]) {
      const res = await api('post', '/clients', manager, clientBody(extra));
      expect(res.status).toBe(400);
    }
  });

  it('searches by name, code, PAN and GSTIN, filters by status and paginates', async () => {
    const body = clientBody({ name: 'Zebra Searchable Traders' });
    const created = (await api('post', '/clients', manager, body)).body;
    for (const term of [
      'zebra searchable',
      created.clientCode.toLowerCase(),
      body.pan.toLowerCase(),
      body.gstin,
    ]) {
      const res = await api('get', `/clients?q=${encodeURIComponent(term)}`, member);
      expect(res.status).toBe(200);
      expect(res.body.items.map((c: { id: string }) => c.id)).toContain(created.id);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    }
    expect((await api('get', '/clients?active=false', member)).body.items).toEqual([]);
    const page = await api('get', '/clients?page=1&pageSize=2', member);
    expect(page.body.items.length).toBeLessThanOrEqual(2);
    expect(page.body.pageSize).toBe(2);
    expect((await api('get', '/clients?pageSize=1000', member)).status).toBe(400);
  });

  it('keeps the client code on update and writes a before/after audit row', async () => {
    const created = (await api('post', '/clients', manager, clientBody())).body;
    const update = clientBody({ name: 'Renamed Client', pan: created.pan, gstin: created.gstin });
    const res = await api('put', `/clients/${created.id}`, manager, update);
    expect(res.status).toBe(200);
    expect(res.body.clientCode).toBe(created.clientCode);
    expect(res.body.name).toBe('Renamed Client');
    const rows = await q<{ changes: { fields: string[] } }>(
      `SELECT changes FROM audit_logs WHERE "entityId" = $1 AND action = 'client.update'`,
      [created.id],
    );
    expect(rows[0]!.changes.fields).toContain('name');
    // The code is also protected by a database trigger.
    await expect(
      owner.query(`UPDATE clients SET "clientCode" = 'CLI-9999' WHERE id = $1`, [created.id]),
    ).rejects.toThrow(/permanent/);
  });

  it('deactivates and reactivates (audited) and has no delete', async () => {
    const created = (await api('post', '/clients', manager, clientBody())).body;
    expect(
      (await api('patch', `/clients/${created.id}/active`, manager, { active: false })).status,
    ).toBe(204);
    expect((await api('get', `/clients/${created.id}`, manager)).body.active).toBe(false);
    expect(
      (await api('patch', `/clients/${created.id}/active`, manager, { active: true })).status,
    ).toBe(204);
    const actions = (
      await q<{ action: string }>(
        `SELECT action FROM audit_logs WHERE "entityId" = $1 ORDER BY "createdAt"`,
        [created.id],
      )
    ).map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining(['client.create', 'client.deactivate', 'client.reactivate']),
    );
    expect((await api('delete', `/clients/${created.id}`, manager)).status).toBe(404);
  });

  it('answers 409 for a duplicate PAN and 404 for another tenant, and enforces permissions', async () => {
    const body = clientBody();
    expect((await api('post', '/clients', manager, body)).status).toBe(201);
    const dup = await api('post', '/clients', manager, clientBody({ pan: body.pan, gstin: null }));
    expect(dup.status).toBe(409);

    // plain user has no clients.view; member has view only.
    expect((await api('get', '/clients', plain)).status).toBe(403);
    expect((await api('post', '/clients', member, clientBody())).status).toBe(403);
    const created = (await api('post', '/clients', manager, clientBody())).body;
    expect((await api('put', `/clients/${created.id}`, member, clientBody())).status).toBe(403);
    expect(
      (await api('patch', `/clients/${created.id}/active`, lead, { active: false })).status,
    ).toBe(403);

    // Tenant B cannot see tenant A's client.
    const bUser = await createFixtureUser(owner, B, 'manager');
    expect((await api('get', `/clients/${created.id}`, bUser, undefined, B)).status).toBe(404);
  });

  it('limits clients to the actor’s branches', async () => {
    const other = (await api('post', '/clients', board, clientBody({ branchId: A.otherBranchId })))
      .body;
    expect(other.branchId).toBe(A.otherBranchId);
    // member only has access to the main branch: not listed, not readable.
    const list = await api('get', `/clients?q=${other.clientCode}`, member);
    expect(list.body.items).toEqual([]);
    expect((await api('get', `/clients/${other.id}`, member)).status).toBe(404);
    // manager cannot create in a branch they cannot use.
    const denied = await api(
      'post',
      '/clients',
      manager,
      clientBody({ branchId: A.otherBranchId }),
    );
    expect(denied.status).toBe(403);
    // Board (all branches) can.
    expect((await api('get', `/clients/${other.id}`, board)).status).toBe(200);
  });

  it('serves reference data and team options', async () => {
    const ref = await api('get', '/clients/reference-data', member);
    expect(ref.body.organisationTypes.map((t: { key: string }) => t.key)).toEqual(
      expect.arrayContaining(['pvt-co', 'individual']),
    );
    expect(ref.body.laws.length).toBe(3);
    const team = await api('get', '/clients/team-options', member);
    expect(team.body.items.length).toBeGreaterThan(3);
    expect(JSON.stringify(team.body)).not.toMatch(/passwordHash|email/);
  });

  it('refuses a team member who is not an active staff member', async () => {
    const res = await api('post', '/clients', manager, clientBody({ teamIds: [randomUUID()] }));
    expect(res.status).toBe(400);
  });
});

describe('permanent codes', () => {
  it('issues unique, gap-free client codes under parallel creates', async () => {
    const before = (
      await q<{ lastValue: number }>(
        `SELECT "lastValue" FROM code_sequences WHERE "tenantId" = $1 AND kind = 'client'`,
        [A.tenantId],
      )
    )[0]!.lastValue;
    const results = await Promise.all(
      Array.from({ length: 12 }, () => api('post', '/clients', manager, clientBody())),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    const codes = results.map((r) => r.body.clientCode as string);
    expect(new Set(codes).size).toBe(12);
    const numbers = codes.map((c) => Number(c.slice(4))).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 12 }, (_, i) => before + 1 + i));
  });

  it('never reuses an employee code, also after a soft delete', async () => {
    const created = await api('post', '/users', manager, {
      name: 'Mistake Entry',
      email: `mistake-${randomUUID().slice(0, 6)}@staff.test`,
      positionId: A.positions.lead,
      generateTemporaryPassword: true,
    });
    expect(created.status).toBe(201);
    const code: string = created.body.user.employeeCode;
    expect((await api('delete', `/users/${created.body.user.id}`, manager)).status).toBe(204);
    // The row is soft-deleted, so the unique (tenantId, employeeCode) still reserves the code ...
    const rows = await q<{ deletedAt: Date | null }>(
      `SELECT "deletedAt" FROM users WHERE "employeeCode" = $1 AND "tenantId" = $2`,
      [code, A.tenantId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.deletedAt).not.toBeNull();
    await expect(
      owner.query(
        `INSERT INTO users ("tenantId", email, name, "employeeCode", "passwordHash") VALUES ($1, 'dup@x.test', 'Dup', $2, 'x')`,
        [A.tenantId, code],
      ),
    ).rejects.toThrow(/unique|duplicate/i);
    // ... and the sequence only moves forward.
    const next = await api('post', '/users', manager, {
      name: 'Next Person',
      email: `next-${randomUUID().slice(0, 6)}@staff.test`,
      positionId: A.positions.lead,
      generateTemporaryPassword: true,
    });
    expect(Number(next.body.user.employeeCode.slice(4))).toBeGreaterThan(Number(code.slice(4)));
  });

  it('keeps a person’s employee code when the position changes and refuses edits to it', async () => {
    const created = await api('post', '/users', board, {
      name: 'Promotable Person',
      email: `promo-${randomUUID().slice(0, 6)}@staff.test`,
      positionId: A.positions.member,
      managerId: lead.id,
      generateTemporaryPassword: true,
    });
    const { id, employeeCode } = created.body.user;
    const moved = await api('patch', `/users/${id}`, board, {
      positionId: A.positions.lead,
      managerId: manager.id,
    });
    expect(moved.status).toBe(200);
    expect(moved.body.employeeCode).toBe(employeeCode);
    expect(moved.body.positionId).toBe(A.positions.lead);
    expect((await api('patch', `/users/${id}`, board, { employeeCode: 'EMP-9999' })).status).toBe(
      400,
    );
    // The user's role follows the position.
    const roles = await q<{ roleId: string }>(
      `SELECT "roleId" FROM user_roles WHERE "userId" = $1`,
      [id],
    );
    expect(roles.map((r) => r.roleId)).toEqual([A.roles.lead]);
  });
});

describe('credentials', () => {
  let clientId: string;

  beforeAll(async () => {
    clientId = (await api('post', '/clients', manager, clientBody())).body.id;
  });

  it('stores values encrypted and never returns them from any list or get endpoint', async () => {
    const set = await api('put', `/clients/${clientId}/credentials`, manager, {
      key: 'mca.password',
      value: SECRET,
    });
    expect(set.status).toBe(204);

    const row = (
      await q<Record<string, Buffer | string>>(
        `SELECT * FROM client_credentials WHERE "clientId" = $1`,
        [clientId],
      )
    )[0]!;
    expect(Buffer.from(row.ciphertext as Buffer).toString('utf8')).not.toContain(SECRET);
    expect((row.iv as Buffer).length).toBe(12);
    expect((row.authTag as Buffer).length).toBe(16);
    expect(row.keyId).toBe('v1');
    expect(JSON.stringify(row)).not.toContain(SECRET);

    const responses = [
      await api('get', `/clients/${clientId}`, manager),
      await api('get', '/clients?pageSize=100', manager),
      await api('get', `/clients/${clientId}/credentials/audit`, manager),
      await api('get', '/clients/team-options', manager),
      await api('get', '/users?pageSize=100', manager),
      await api('get', '/users/assignable', manager),
      await api('get', '/departments', manager),
      await api('get', '/positions', manager),
      await api('get', '/roles', manager),
      await api('get', '/auth/me', manager),
    ];
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(SECRET);
    }
    expect((await api('get', `/clients/${clientId}`, manager)).body.credentialsSet).toEqual([
      'mca.password',
    ]);

    // Audit rows describe WHAT changed, never the value.
    const audit = await q<{ changes: unknown }>(
      `SELECT changes FROM audit_logs WHERE "entityId" = $1`,
      [clientId],
    );
    expect(JSON.stringify(audit)).not.toContain(SECRET);
    // There is no endpoint that reads a value back except the reveal.
    for (const path of [
      `/clients/${clientId}/credentials`,
      `/clients/${clientId}/credentials/mca.password`,
    ]) {
      expect((await api('get', path, manager)).status).toBe(404);
    }
  });

  it('refuses unknown fields and over-long values', async () => {
    expect(
      (
        await api('put', `/clients/${clientId}/credentials`, manager, {
          key: 'nope.id',
          value: 'x',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await api('put', `/clients/${clientId}/credentials`, manager, {
          key: 'mca.id',
          value: 'x'.repeat(500),
        })
      ).status,
    ).toBe(400);
    expect(
      (await api('put', `/clients/${clientId}/credentials`, member, { key: 'mca.id', value: 'x' }))
        .status,
    ).toBe(403);
  });

  it('reveals only with the permission AND the current password, and writes the audit row', async () => {
    // member has clients.view but not clients.reveal_credentials.
    const noPermission = await api('post', `/clients/${clientId}/credentials/reveal`, member, {
      key: 'mca.password',
      password: TEST_PASSWORD,
    });
    expect(noPermission.status).toBe(403);

    const noPassword = await api('post', `/clients/${clientId}/credentials/reveal`, manager, {
      key: 'mca.password',
    });
    expect(noPassword.status).toBe(400);

    const wrong = await api('post', `/clients/${clientId}/credentials/reveal`, manager, {
      key: 'mca.password',
      password: 'Wrong-Password-1!',
    });
    expect(wrong.status).toBe(403);
    expect(wrong.body.code).toBe('INVALID_PASSWORD');
    expect(JSON.stringify(wrong.body)).not.toContain(SECRET);

    const ok = await api('post', `/clients/${clientId}/credentials/reveal`, manager, {
      key: 'mca.password',
      password: TEST_PASSWORD,
      worksheetId: 'ws-1',
    });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ value: SECRET });
    expect(ok.headers['cache-control']).toContain('no-store');

    const missing = await api('post', `/clients/${clientId}/credentials/reveal`, manager, {
      key: 'gst.password',
      password: TEST_PASSWORD,
    });
    expect(missing.status).toBe(404);

    const rows = await q<{ action: string; userId: string; changes: { field: string } }>(
      `SELECT action, "userId", changes FROM audit_logs WHERE "entityId" = $1 AND action LIKE 'client.credential.%' ORDER BY "createdAt"`,
      [clientId],
    );
    expect(rows.map((r) => r.action)).toEqual(
      expect.arrayContaining([
        'client.credential.update',
        'client.credential.reveal.denied',
        'client.credential.reveal',
      ]),
    );
    const reveal = rows.find((r) => r.action === 'client.credential.reveal')!;
    expect(reveal.userId).toBe(manager.id);
    expect(reveal.changes.field).toBe('mca.password');
    expect(JSON.stringify(rows)).not.toContain(SECRET);

    // The access log endpoint shows who did what, without values.
    const log = await api('get', `/clients/${clientId}/credentials/audit`, manager);
    expect(log.body.items.map((i: { action: string }) => i.action)).toEqual(
      expect.arrayContaining(['revealed', 'updated', 'denied']),
    );
    expect(JSON.stringify(log.body)).not.toContain(SECRET);
  });

  it('rate limits reveals to 5 per minute per user', async () => {
    const user = await createFixtureUser(owner, A, 'lead', { managerId: manager.id });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await api('post', `/clients/${clientId}/credentials/reveal`, user, {
        key: 'mca.password',
        password: TEST_PASSWORD,
      });
      statuses.push(res.status);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it('blocks reveal after 5 wrong passwords within 15 minutes, without locking the account', async () => {
    const user = await createFixtureUser(owner, A, 'lead', { managerId: manager.id });
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push(
        (
          await api('post', `/clients/${clientId}/credentials/reveal`, user, {
            key: 'mca.password',
            password: `Wrong-Password-${i}!`,
          })
        ).status,
      );
    }
    expect(statuses).toEqual([403, 403, 403, 403, 403]);
    const blocked = await q(
      `SELECT 1 FROM audit_logs WHERE "userId" = $1 AND action = 'client.credential.reveal.blocked'`,
      [user.id],
    );
    expect(blocked).toHaveLength(1);
    // Even the CORRECT password is refused while blocked ...
    const refused = await api('post', `/clients/${clientId}/credentials/reveal`, user, {
      key: 'mca.password',
      password: TEST_PASSWORD,
    });
    expect(refused.status).toBe(429);
    // ... but the account itself is not locked: login and other endpoints still work.
    expect((await login(A, user.email)).status).toBe(200);
    expect((await api('get', '/clients', user)).status).toBe(200);
  });

  it('lets a user reveal again once the 15-minute block has passed', async () => {
    const user = await createFixtureUser(owner, A, 'lead', { managerId: manager.id });
    // Backdated audit rows: 5 wrong passwords and a block that started 20 minutes ago.
    const client = await owner.connect();
    try {
      for (const [action, minutes] of [
        ['client.credential.reveal.denied', 25],
        ['client.credential.reveal.denied', 24],
        ['client.credential.reveal.denied', 23],
        ['client.credential.reveal.denied', 22],
        ['client.credential.reveal.denied', 21],
        ['client.credential.reveal.blocked', 20],
      ] as const) {
        await client.query(
          `INSERT INTO audit_logs ("tenantId", "userId", action, entity, "entityId", "createdAt")
           VALUES ($1, $2, $3, 'client', $4, now() - make_interval(mins => $5::int))`,
          [A.tenantId, user.id, action, clientId, minutes],
        );
      }
    } finally {
      client.release();
    }
    const ok = await api('post', `/clients/${clientId}/credentials/reveal`, user, {
      key: 'mca.password',
      password: TEST_PASSWORD,
    });
    expect(ok.status).toBe(200);
    // And a block that started 5 minutes ago still applies.
    const blockedUser = await createFixtureUser(owner, A, 'lead', { managerId: manager.id });
    await owner.query(
      `INSERT INTO audit_logs ("tenantId", "userId", action, entity, "entityId", "createdAt")
       VALUES ($1, $2, 'client.credential.reveal.blocked', 'client', $3, now() - interval '5 minutes')`,
      [A.tenantId, blockedUser.id, clientId],
    );
    const stillBlocked = await api('post', `/clients/${clientId}/credentials/reveal`, blockedUser, {
      key: 'mca.password',
      password: TEST_PASSWORD,
    });
    expect(stillBlocked.status).toBe(429);
    expect(stillBlocked.body.code).toBe('REVEAL_BLOCKED');
  });

  it('never writes secrets, passwords or temporary passwords to the logs', async () => {
    // The app under test logs into `logs`, so we can read exactly what a real deployment would log.
    const chunks = logs;
    const probeId = (await api('post', '/clients', manager, clientBody())).body.id as string;
    const probeSecret = 'Log-Probe-Secret-4d9b';
    const wrong = 'Wrong-Log-Probe-1!';
    let temporary = '';
    try {
      await api('put', `/clients/${probeId}/credentials`, manager, {
        key: 'gst.password',
        value: probeSecret,
      });
      await api('post', `/clients/${probeId}/credentials/reveal`, manager, {
        key: 'gst.password',
        password: wrong,
      });
      await api('post', `/clients/${probeId}/credentials/reveal`, manager, {
        key: 'gst.password',
        password: TEST_PASSWORD,
      });
      const created = await api('post', '/users', manager, {
        name: 'Log Probe',
        email: `probe-${randomUUID().slice(0, 6)}@staff.test`,
        positionId: A.positions.lead,
        generateTemporaryPassword: true,
      });
      temporary = created.body.temporaryPassword as string;
      await login(A, created.body.user.email, temporary);
      await login(A, manager.email, wrong);
      // Give the (asynchronous) log transport a moment to flush.
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      // (nothing to restore: the stream stays attached to this app)
    }
    const output = chunks.join('');
    // Prove the capture works: request log lines are there ...
    expect(output).toContain('request completed');
    expect(output).toContain('/credentials/reveal');
    // ... and none of the sensitive values are.
    for (const value of [probeSecret, wrong, TEST_PASSWORD, temporary, SECRET]) {
      expect(value.length).toBeGreaterThan(8);
      expect(output, `log contains a sensitive value`).not.toContain(value);
    }
  });

  it('clears a value with an empty string and audits it', async () => {
    const id = (await api('post', '/clients', manager, clientBody())).body.id;
    await api('put', `/clients/${id}/credentials`, manager, { key: 'gst.id', value: 'TEMP-VALUE' });
    expect(
      (await api('put', `/clients/${id}/credentials`, manager, { key: 'gst.id', value: '' }))
        .status,
    ).toBe(204);
    expect((await api('get', `/clients/${id}`, manager)).body.credentialsSet).toEqual([]);
    const rows = await q(
      `SELECT 1 FROM audit_logs WHERE "entityId" = $1 AND action = 'client.credential.clear'`,
      [id],
    );
    expect(rows).toHaveLength(1);
  });
});

describe('staff visibility and rules', () => {
  it('shows Board everything and everyone else only themselves and their subtree', async () => {
    const all = await api('get', '/users?pageSize=100', board);
    expect(all.body.items.length).toBeGreaterThanOrEqual(7);

    const leadView = await api('get', '/users?pageSize=100', lead);
    const ids = leadView.body.items.map((u: { id: string }) => u.id);
    expect(ids).toEqual(expect.arrayContaining([lead.id, member.id]));
    expect(ids).not.toContain(member2.id);
    expect(ids).not.toContain(manager.id);
    expect(ids).not.toContain(board.id);
    const self = leadView.body.items.find((u: { id: string }) => u.id === lead.id);
    expect(self.canManage).toBe(false);
    expect(leadView.body.items.find((u: { id: string }) => u.id === member.id).canManage).toBe(
      true,
    );

    expect((await api('get', `/users/${member2.id}`, lead)).status).toBe(404);
    expect((await api('get', `/users/${member.id}`, lead)).status).toBe(200);
    expect((await api('get', '/users', plain)).status).toBe(403);
  });

  it('never returns password hashes', async () => {
    const res = await api('get', `/users/${member.id}`, board);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|scrypt/i);
  });

  it('searches by name, code and email', async () => {
    for (const term of [member.employeeCode, member.email.split('@')[0]!, 'Test member']) {
      const res = await api('get', `/users?q=${encodeURIComponent(term)}`, board);
      expect(res.body.items.map((u: { id: string }) => u.id)).toContain(member.id);
    }
  });

  it('lets a lead create people only in the position directly below theirs', async () => {
    const creatable = await api('get', '/users/creatable-positions', lead);
    expect(creatable.body.positionIds).toEqual([A.positions.member]);

    const ok = await api('post', '/users', lead, {
      name: 'Fresh Member',
      email: `fresh-${randomUUID().slice(0, 6)}@staff.test`,
      phone: '9847000333',
      dateOfBirth: '1996-04-12',
      dateOfJoining: '2026-11-01',
      positionId: A.positions.member,
      managerId: manager.id, // ignored: new people report to the creator
      generateTemporaryPassword: true,
    });
    expect(ok.status).toBe(201);
    expect(ok.body.user.managerId).toBe(lead.id);
    expect(ok.body.user.employeeCode).toMatch(/^EMP-\d{4}$/);
    expect(ok.body.user.mustChangePassword).toBe(true);
    expect(typeof ok.body.temporaryPassword).toBe('string');
    expect(ok.headers['cache-control']).toContain('no-store');
    expect(JSON.stringify(ok.body)).not.toMatch(/passwordHash/);
    // The temporary password is shown once: neither the GET nor the audit row carries it.
    const again = await api('get', `/users/${ok.body.user.id}`, lead);
    expect(JSON.stringify(again.body)).not.toContain(ok.body.temporaryPassword);
    const audit = await q(`SELECT changes FROM audit_logs WHERE "entityId" = $1`, [
      ok.body.user.id,
    ]);
    expect(JSON.stringify(audit)).not.toContain(ok.body.temporaryPassword);

    const wrongLevel = await api('post', '/users', lead, {
      name: 'Too High',
      email: `high-${randomUUID().slice(0, 6)}@staff.test`,
      positionId: A.positions.manager,
      generateTemporaryPassword: true,
    });
    expect(wrongLevel.status).toBe(403);
    const foreign = await api('post', '/users', manager, {
      name: 'Foreign',
      email: `foreign-${randomUUID().slice(0, 6)}@staff.test`,
      positionId: B.positions.lead,
      generateTemporaryPassword: true,
    });
    expect(foreign.status).toBe(400);
  });

  it('accepts an admin-chosen password only if it passes the policy', async () => {
    const email = `chosen-${randomUUID().slice(0, 6)}@staff.test`;
    const base = { name: 'Chosen Person', email, positionId: A.positions.lead };
    expect((await api('post', '/users', manager, { ...base, password: 'short' })).status).toBe(400);
    expect(
      (await api('post', '/users', manager, { ...base, password: 'Password123!' })).body.code,
    ).toBe('WEAK_PASSWORD');
    expect((await api('post', '/users', manager, { ...base })).status).toBe(400); // neither password nor generate
    expect(
      (
        await api('post', '/users', manager, {
          ...base,
          password: 'Valid-Phrase-Number-7!',
          generateTemporaryPassword: true,
        })
      ).status,
    ).toBe(400);
    const ok = await api('post', '/users', manager, {
      ...base,
      password: 'Valid-Phrase-Number-7!',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.temporaryPassword).toBeNull();
    expect(
      (await api('post', '/users', manager, { ...base, password: 'Another-Valid-Phrase-8!' }))
        .status,
    ).toBe(409); // email taken
  });

  it('enforces who may edit whom and who may move people', async () => {
    expect(
      (await api('patch', `/users/${member.id}`, lead, { name: 'Renamed Member' })).status,
    ).toBe(200);
    expect((await api('patch', `/users/${member2.id}`, lead, { name: 'Nope' })).status).toBe(404);
    expect((await api('patch', `/users/${lead.id}`, lead, { name: 'Self' })).status).toBe(403);
    // Only Board/GM with position.move may change position or manager.
    expect((await api('patch', `/users/${member.id}`, lead, { managerId: lead2.id })).status).toBe(
      403,
    );
    expect(
      (await api('patch', `/users/${member.id}`, manager, { positionId: A.positions.lead })).status,
    ).toBe(403);
    // No cycles: a person cannot report to one of their own reports.
    const cycle = await api('patch', `/users/${lead.id}`, board, { managerId: member.id });
    expect(cycle.status).toBe(400);
    expect(cycle.body.code).toBe('ORG_CYCLE');
    expect(
      (await api('patch', `/users/${lead.id}`, board, { dateOfBirth: '2999-01-01' })).status,
    ).toBe(400);
  });

  it('refuses to deactivate or delete yourself and checks permissions', async () => {
    expect((await api('post', `/users/${manager.id}/deactivate`, manager)).status).toBe(403);
    expect((await api('delete', `/users/${manager.id}`, manager)).status).toBe(403);
    expect((await api('post', `/users/${member.id}/deactivate`, member)).status).toBe(403);
  });

  it('deactivating a user ends their sessions at once, and reactivating restores access', async () => {
    const created = await api('post', '/users', manager, {
      name: 'Session Victim',
      email: `victim-${randomUUID().slice(0, 6)}@staff.test`,
      positionId: A.positions.lead,
      password: 'Blue-Harbor-Phrase-5!',
    });
    const victimId: string = created.body.user.id;
    // Clear the must-change flag so the user can work (the flow is tested separately).
    await owner.query(`UPDATE users SET "mustChangePassword" = false WHERE id = $1`, [victimId]);
    const first = await login(A, created.body.user.email, 'Blue-Harbor-Phrase-5!');
    const second = await login(A, created.body.user.email, 'Blue-Harbor-Phrase-5!');
    const token = first.body.accessToken as string;
    const asVictim = (path: string) =>
      request(app.getHttpServer())
        .get(`/api/v1${path}`)
        .set('Host', A.host)
        .set('Authorization', `Bearer ${token}`);
    expect((await asVictim('/auth/me')).status).toBe(200);

    expect((await api('post', `/users/${victimId}/deactivate`, manager)).status).toBe(204);

    expect((await asVictim('/auth/me')).status).toBe(401);
    expect((await asVictim('/clients')).status).toBe(401);
    const refresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Host', A.host)
      .set('X-Requested-With', CSRF_HEADER_VALUE)
      .set('Cookie', second.cookie);
    expect(refresh.status).toBe(401);
    expect((await login(A, created.body.user.email, 'Blue-Harbor-Phrase-5!')).status).toBe(401);
    const live = await q(`SELECT 1 FROM sessions WHERE "userId" = $1 AND "revokedAt" IS NULL`, [
      victimId,
    ]);
    expect(live).toHaveLength(0);

    // Deactivated staff are not assignable and show under the inactive filter.
    const assignable = await api('get', '/users/assignable', manager);
    expect(assignable.body.items.map((u: { id: string }) => u.id)).not.toContain(victimId);
    const inactive = await api('get', '/users?active=false', manager);
    expect(inactive.body.items.map((u: { id: string }) => u.id)).toContain(victimId);

    expect((await api('post', `/users/${victimId}/reactivate`, manager)).status).toBe(204);
    expect((await login(A, created.body.user.email, 'Blue-Harbor-Phrase-5!')).status).toBe(200);
    const actions = (
      await q<{ action: string }>(`SELECT action FROM audit_logs WHERE "entityId" = $1`, [victimId])
    ).map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining(['user.create', 'user.deactivate', 'user.reactivate']),
    );
  });

  it('answers 409 when deleting a person with history and deletes a row created by mistake', async () => {
    // Manages someone.
    const boss = await api('post', '/users', manager, {
      name: 'Boss Person',
      email: `boss-${randomUUID().slice(0, 6)}@staff.test`,
      positionId: A.positions.lead,
      generateTemporaryPassword: true,
    });
    await owner.query(`UPDATE users SET "managerId" = $1 WHERE id = $2`, [
      boss.body.user.id,
      plain.id,
    ]);
    const withReports = await api('delete', `/users/${boss.body.user.id}`, manager);
    expect(withReports.status).toBe(409);
    expect(withReports.body.code).toBe('HAS_HISTORY');
    expect(withReports.body.message).toMatch(/Deactivate them instead/);
    await owner.query(`UPDATE users SET "managerId" = $1 WHERE id = $2`, [manager.id, plain.id]);

    // Has recorded activity (a login).
    const worked = await api('post', '/users', manager, {
      name: 'Worked Person',
      email: `worked-${randomUUID().slice(0, 6)}@staff.test`,
      positionId: A.positions.lead,
      password: 'Green-Falcon-Phrase-3!',
    });
    await login(A, worked.body.user.email, 'Green-Falcon-Phrase-3!');
    expect((await api('delete', `/users/${worked.body.user.id}`, manager)).status).toBe(409);

    // Created and edited a client.
    const author = await createFixtureUser(owner, A, 'lead', { managerId: manager.id });
    await api('post', '/clients', manager, clientBody({ teamIds: [author.id] }));
    expect((await api('delete', `/users/${author.id}`, manager)).status).toBe(409);

    // A row created by mistake can be deleted.
    const mistake = await api('post', '/users', manager, {
      name: 'By Mistake',
      email: `oops-${randomUUID().slice(0, 6)}@staff.test`,
      positionId: A.positions.lead,
      generateTemporaryPassword: true,
    });
    expect((await api('delete', `/users/${mistake.body.user.id}`, manager)).status).toBe(204);
    expect((await api('get', `/users/${mistake.body.user.id}`, manager)).status).toBe(404);
    const email = mistake.body.user.email;
    // The email is released for reuse; the code is not.
    const reused = await api('post', '/users', manager, {
      name: 'Same Email',
      email,
      positionId: A.positions.lead,
      generateTemporaryPassword: true,
    });
    expect(reused.status).toBe(201);
    expect(reused.body.user.employeeCode).not.toBe(mistake.body.user.employeeCode);
  });
});

describe('temporary password flow', () => {
  it('forces a password change at first login, then unlocks everything', async () => {
    const created = await api('post', '/users', manager, {
      name: 'Temp Person',
      email: `temp-${randomUUID().slice(0, 6)}@staff.test`,
      positionId: A.positions.lead,
      generateTemporaryPassword: true,
    });
    const email: string = created.body.user.email;
    const temporary: string = created.body.temporaryPassword;

    const first = await login(A, email, temporary);
    expect(first.status).toBe(200);
    expect((first.body.user as { mustChangePassword: boolean }).mustChangePassword).toBe(true);
    const token = first.body.accessToken as string;
    const as = (method: 'get' | 'post', path: string) =>
      request(app.getHttpServer())
        [method](`/api/v1${path}`)
        .set('Host', A.host)
        .set('Authorization', `Bearer ${token}`);

    const me = await as('get', '/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.mustChangePassword).toBe(true);
    for (const path of ['/clients', '/users', '/departments', '/roles']) {
      const blocked = await as('get', path);
      expect(blocked.status, path).toBe(403);
      expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
    }

    // Weak, reused and wrong-current passwords are refused.
    const change = (current: string, next: string) =>
      as('post', '/auth/change-password').send({ currentPassword: current, newPassword: next });
    expect((await change(temporary, 'short')).status).toBe(400);
    expect((await change(temporary, 'Password123!')).body.code).toBe('WEAK_PASSWORD');
    expect((await change(temporary, temporary)).status).toBe(400);
    expect((await change('Not-The-Current-1!', 'Brand-New-Phrase-42!')).status).toBe(401);

    const secondSession = await login(A, email, temporary);
    expect((await change(temporary, 'Brand-New-Phrase-42!')).status).toBe(204);

    expect((await as('get', '/clients')).status).toBe(200);
    expect((await as('get', '/auth/me')).body.user.mustChangePassword).toBe(false);
    // The temporary password no longer works; other sessions ended; the new password works.
    expect((await login(A, email, temporary)).status).toBe(401);
    const other = request(app.getHttpServer())
      .get('/api/v1/clients')
      .set('Host', A.host)
      .set('Authorization', `Bearer ${secondSession.body.accessToken as string}`);
    expect((await other).status).toBe(401);
    expect((await login(A, email, 'Brand-New-Phrase-42!')).status).toBe(200);
    const actions = (
      await q<{ action: string }>(`SELECT action FROM audit_logs WHERE "userId" = $1`, [
        created.body.user.id,
      ])
    ).map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining(['auth.password.change', 'auth.password.change.failure']),
    );
  });
});

describe('organization', () => {
  it('lists departments, positions and roles for dropdowns and checks permissions', async () => {
    const departments = await api('get', '/departments', member);
    expect(departments.body.items[0]).toEqual(
      expect.objectContaining({ code: 'OPS', name: 'Operations' }),
    );
    const positions = await api('get', '/positions', member);
    expect(positions.body.items.length).toBe(5);
    expect(positions.body.items[0]).toHaveProperty('designationCode');
    expect((await api('get', '/roles', member)).body.items.length).toBe(5);
    expect((await api('get', '/departments', plain)).status).toBe(403);
    expect(
      (await api('post', '/departments', member, { code: 'FIN', name: 'Finance' })).status,
    ).toBe(403);
  });

  it('creates and updates departments and positions with permanent codes and audit rows', async () => {
    const dept = await api('post', '/departments', manager, {
      code: 'FIN_OPS',
      name: 'Finance Ops',
    });
    expect(dept.status).toBe(201);
    expect(
      (await api('post', '/departments', manager, { code: 'FIN_OPS', name: 'Again' })).status,
    ).toBe(409);
    expect(
      (await api('post', '/departments', manager, { code: 'FIN-2', name: 'Digits' })).status,
    ).toBe(400);
    expect(
      (await api('post', '/departments', manager, { code: 'fin', name: 'Lower' })).status,
    ).toBe(400);
    // The code cannot be changed (strict schema).
    expect(
      (
        await api('patch', `/departments/${dept.body.id}`, manager, {
          name: 'Renamed',
          code: 'NEW',
        })
      ).status,
    ).toBe(400);
    expect(
      (await api('patch', `/departments/${dept.body.id}`, manager, { name: 'Renamed Dept' })).body
        .code,
    ).toBe('FIN_OPS');

    const position = await api('post', '/positions', manager, {
      code: 'FIN-OFFICER',
      name: 'Finance Officer',
      designationCode: 'TL',
      departmentId: dept.body.id,
      roleId: A.roles.lead,
      parentId: A.positions.manager,
    });
    expect(position.status).toBe(201);
    expect(position.body.designationCode).toBe('TL');
    expect(position.body.seesAll).toBe(false); // never settable through the API
    expect(
      (
        await api('post', '/positions', manager, {
          code: 'BAD1',
          name: 'x',
          departmentId: dept.body.id,
          roleId: A.roles.lead,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await api('post', '/positions', manager, {
          code: 'ROLEX',
          name: 'x',
          departmentId: dept.body.id,
          roleId: randomUUID(),
        })
      ).status,
    ).toBe(400);
    const actions = (
      await q<{ action: string }>(
        `SELECT action FROM audit_logs WHERE "tenantId" = $1 AND entity IN ('department', 'position')`,
        [A.tenantId],
      )
    ).map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining(['department.create', 'department.update', 'position.create']),
    );
  });

  it('prevents a position or department from becoming its own descendant', async () => {
    // board > manager > lead > member
    const cycle = await api('patch', `/positions/${A.positions.board}`, manager, {
      name: 'Board',
      departmentId: A.departmentId,
      roleId: A.roles.board,
      parentId: A.positions.member,
    });
    expect(cycle.status).toBe(400);
    expect(cycle.body.code).toBe('ORG_CYCLE');
    const self = await api('patch', `/positions/${A.positions.lead}`, manager, {
      name: 'Lead',
      departmentId: A.departmentId,
      roleId: A.roles.lead,
      parentId: A.positions.lead,
    });
    expect(self.body.code).toBe('ORG_CYCLE');
    const ok = await api('patch', `/positions/${A.positions.plain}`, manager, {
      name: 'Plain',
      departmentId: A.departmentId,
      roleId: A.roles.plain,
      parentId: A.positions.lead,
    });
    expect(ok.status).toBe(200);

    // The database refuses a cycle too (protection against concurrent edits).
    await expect(
      owner.query(`UPDATE org_positions SET "parentPositionId" = $1 WHERE id = $2`, [
        A.positions.member,
        A.positions.board,
      ]),
    ).rejects.toThrow(/its own ancestor/);
    await expect(
      owner.query(`UPDATE users SET "managerId" = $1 WHERE id = $2`, [member.id, board.id]),
    ).rejects.toThrow(/its own ancestor/);
  });
});

describe('row-level security on the new tables', () => {
  const app$ = new pg.Pool({ connectionString: env('DATABASE_URL') });
  let clientA: string;
  let clientB: string;
  let userB: FixtureUser;

  async function asApp<T extends pg.QueryResultRow>(
    tenantId: string | null,
    sql: string,
    params: unknown[] = [],
  ) {
    const c = await app$.connect();
    try {
      await c.query('BEGIN');
      if (tenantId) await c.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
      const res = await c.query<T>(sql, params);
      await c.query('COMMIT');
      return res;
    } catch (error) {
      await c.query('ROLLBACK');
      throw error;
    } finally {
      c.release();
    }
  }

  beforeAll(async () => {
    userB = await createFixtureUser(owner, B, 'manager');
    clientA = (await api('post', '/clients', manager, clientBody({ teamIds: [lead.id] }))).body.id;
    clientB = (await api('post', '/clients', userB, clientBody(), B)).body.id;
    await api('put', `/clients/${clientA}/credentials`, manager, { key: 'mca.id', value: 'x-1' });
    await api('put', `/clients/${clientB}/credentials`, userB, { key: 'mca.id', value: 'x-2' }, B);
  });

  afterAll(async () => {
    await app$.end();
  });

  const TABLES = [
    'code_sequences',
    'organisation_types',
    'compliance_laws',
    'clients',
    'client_directors',
    'client_laws',
    'client_team',
    'client_credentials',
  ];

  it('is enabled and forced with a tenant policy on every new table', async () => {
    const rows = await q<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = ANY($1)`,
      [TABLES],
    );
    expect(rows).toHaveLength(TABLES.length);
    expect(rows.every((r) => r.relrowsecurity && r.relforcerowsecurity)).toBe(true);
    const policies = await q<{ tablename: string }>(
      `SELECT tablename FROM pg_policies WHERE policyname = 'tenant_isolation' AND tablename = ANY($1)`,
      [TABLES],
    );
    expect(policies.map((p) => p.tablename).sort()).toEqual([...TABLES].sort());
  });

  it.each(TABLES)(
    '%s: tenant A sees only its own rows and nothing without a tenant',
    async (table) => {
      const own = await asApp<{ tenantId: string }>(A.tenantId, `SELECT "tenantId" FROM ${table}`);
      expect(own.rows.length).toBeGreaterThan(0);
      expect(own.rows.every((r) => r.tenantId === A.tenantId)).toBe(true);
      const other = await asApp(A.tenantId, `SELECT * FROM ${table} WHERE "tenantId" = $1`, [
        B.tenantId,
      ]);
      expect(other.rowCount).toBe(0);
      const none = await asApp(null, `SELECT * FROM ${table}`);
      expect(none.rowCount).toBe(0);
    },
  );

  it.each(['organisation_types', 'compliance_laws'])(
    '%s: cannot write into another tenant',
    async (table) => {
      await expect(
        asApp(A.tenantId, `INSERT INTO ${table} ("tenantId", key, label) VALUES ($1, 'x', 'x')`, [
          B.tenantId,
        ]),
      ).rejects.toThrow(/row-level security/);
    },
  );

  it('cannot update, delete or issue codes for another tenant', async () => {
    const upd = await asApp(A.tenantId, `UPDATE clients SET name = 'hacked' WHERE id = $1`, [
      clientB,
    ]);
    const del = await asApp(A.tenantId, `DELETE FROM client_credentials WHERE "clientId" = $1`, [
      clientB,
    ]);
    expect(upd.rowCount).toBe(0);
    expect(del.rowCount).toBe(0);
    // next_code_value() works on the CURRENT tenant only.
    const before = (
      await q<{ lastValue: number }>(
        `SELECT "lastValue" FROM code_sequences WHERE "tenantId" = $1 AND kind = 'client'`,
        [B.tenantId],
      )
    )[0]!.lastValue;
    await asApp(A.tenantId, `SELECT next_code_value('client')`);
    const after = (
      await q<{ lastValue: number }>(
        `SELECT "lastValue" FROM code_sequences WHERE "tenantId" = $1 AND kind = 'client'`,
        [B.tenantId],
      )
    )[0]!.lastValue;
    expect(after).toBe(before);
  });

  it('refuses rows that point at another tenant (composite tenant foreign keys)', async () => {
    const cases: [string, unknown[]][] = [
      [
        `INSERT INTO client_directors ("tenantId", "clientId", name) VALUES ($1, $2, 'X')`,
        [A.tenantId, clientB],
      ],
      [
        `INSERT INTO client_team ("tenantId", "clientId", "userId") VALUES ($1, $2, $3)`,
        [A.tenantId, clientA, userB.id],
      ],
      [
        `INSERT INTO client_team ("tenantId", "clientId", "userId") VALUES ($1, $2, $3)`,
        [A.tenantId, clientB, lead.id],
      ],
      [
        `INSERT INTO client_credentials ("tenantId", "clientId", field, ciphertext, iv, "authTag", "keyId") VALUES ($1, $2, 'x.id', '\\x00', '\\x00', '\\x00', 'v1')`,
        [A.tenantId, clientB],
      ],
      [
        `INSERT INTO client_laws ("tenantId", "clientId", "lawId") SELECT $1::uuid, $2::uuid, id FROM compliance_laws WHERE "tenantId" = $3 LIMIT 1`,
        [A.tenantId, clientA, B.tenantId],
      ],
      [
        `INSERT INTO clients ("tenantId", "branchId", "clientCode", name, address, "organisationTypeId", pan) SELECT $1::uuid, $2::uuid, 'CLI-8888', 'X', 'X', id, 'AAAAA1111A' FROM organisation_types WHERE "tenantId" = $1 LIMIT 1`,
        [A.tenantId, B.branchId],
      ],
      [
        `INSERT INTO clients ("tenantId", "branchId", "clientCode", name, address, "organisationTypeId", pan) SELECT $1::uuid, $2::uuid, 'CLI-8889', 'X', 'X', id, 'AAAAA1111B' FROM organisation_types WHERE "tenantId" = $3 LIMIT 1`,
        [A.tenantId, A.branchId, B.tenantId],
      ],
    ];
    for (const [sql, params] of cases) {
      await expect(owner.query(sql, params), sql).rejects.toThrow(/foreign key/);
    }
  });

  it('keeps client codes reserved even if the row is soft-deleted (non-partial unique)', async () => {
    const created = (await api('post', '/clients', manager, clientBody())).body;
    await owner.query(`UPDATE clients SET "deletedAt" = now() WHERE id = $1`, [created.id]);
    await expect(
      owner.query(
        `INSERT INTO clients ("tenantId", "branchId", "clientCode", name, address, "organisationTypeId", pan)
         SELECT $1::uuid, $2::uuid, $3, 'Dup', 'Dup', id, 'ZZZZZ9999Z' FROM organisation_types WHERE "tenantId" = $1 LIMIT 1`,
        [A.tenantId, A.branchId, created.clientCode],
      ),
    ).rejects.toThrow(/unique|duplicate/i);
  });
});
