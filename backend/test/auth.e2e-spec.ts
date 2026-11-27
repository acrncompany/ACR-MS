import 'reflect-metadata';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { AppConfig } from '../src/core/config/app-config.js';
import { ScryptPasswordHasher } from '../src/modules/auth/data/scrypt-password-hasher.js';
import { CSRF_HEADER_VALUE } from '../src/modules/auth/presentation/auth-http.js';

/**
 * End-to-end tests of authentication against the real database (docker compose) and the real
 * HTTP stack: tenant resolved from the Host header, httpOnly refresh cookie, rotation, reuse
 * detection, lockout, expiry limits, suspended tenants and cross-tenant isolation.
 */

const PASSWORD = 'Correct-Horse-9';
const COOKIE = process.env.REFRESH_COOKIE_NAME ?? 'acrms_rt';
const BASE_DOMAIN = process.env.TENANT_BASE_DOMAIN ?? 'localhost';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set for the auth integration test`);
  return value;
}

const owner = new pg.Pool({ connectionString: env('MIGRATION_DATABASE_URL') });
const suffix = randomUUID().slice(0, 8);
const tenantA = { id: randomUUID(), host: `auth-a-${suffix}.${BASE_DOMAIN}` };
const tenantB = { id: randomUUID(), host: `auth-b-${suffix}.${BASE_DOMAIN}` };
const roleA = randomUUID();
const positionA = randomUUID();
const deptA = randomUUID();

let app: INestApplication;
let counter = 0;

/** Raised well above anything a test does; one test builds a second app with low limits. */
function useGenerousRateLimits(): void {
  process.env.THROTTLE_LOGIN_LIMIT = '1000';
  process.env.THROTTLE_REFRESH_LIMIT = '1000';
  process.env.THROTTLE_DEFAULT_LIMIT = '1000';
}

async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const created = moduleRef.createNestApplication();
  configureApp(created, created.get(AppConfig));
  await created.init();
  return created;
}

async function createUser(
  tenantId: string,
  overrides: { status?: string; positionId?: string | null } = {},
): Promise<{ id: string; email: string }> {
  const hash = await new ScryptPasswordHasher().hash(PASSWORD);
  const id = randomUUID();
  const email = `user${++counter}-${suffix}@auth.test`;
  const employeeCode = `EMP-${String(1000 + counter).padStart(4, '0')}`;
  await owner.query(
    `INSERT INTO users (id, "tenantId", email, name, "employeeCode", "passwordHash", status, "positionId")
     VALUES ($1, $2, $3, 'Test User', $4, $5, $6::"UserStatus", $7)`,
    [
      id,
      tenantId,
      email,
      employeeCode,
      hash,
      overrides.status ?? 'ACTIVE',
      overrides.positionId ?? null,
    ],
  );
  return { id, email };
}

interface Login {
  accessToken: string;
  cookie: string;
  setCookie: string;
  status: number;
}

function cookieValue(setCookie: string[] | undefined): string {
  const header = setCookie?.find((c) => c.startsWith(`${COOKIE}=`)) ?? '';
  return header.split(';')[0].slice(COOKIE.length + 1);
}

async function login(host: string, email: string, password = PASSWORD): Promise<Login> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('Host', host)
    .send({ email, password });
  const setCookie = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  return {
    status: res.status,
    accessToken: (res.body as { accessToken?: string }).accessToken ?? '',
    cookie: cookieValue(setCookie),
    setCookie: setCookie.find((c) => c.startsWith(`${COOKIE}=`)) ?? '',
  };
}

const post = (path: string, host: string, cookie?: string, csrf = true) => {
  const req = request(app.getHttpServer()).post(`/api/v1/auth/${path}`).set('Host', host);
  if (cookie) req.set('Cookie', `${COOKIE}=${cookie}`);
  if (csrf) req.set('X-Requested-With', CSRF_HEADER_VALUE);
  return req;
};

const me = (host: string, token: string) =>
  request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .set('Host', host)
    .set('Authorization', `Bearer ${token}`);

const q = async <T extends pg.QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> =>
  (await owner.query<T>(sql, params)).rows;

const auditActions = async (userId: string): Promise<string[]> =>
  (
    await q<{ action: string }>(
      `SELECT action FROM audit_logs WHERE "userId" = $1 ORDER BY "createdAt", id`,
      [userId],
    )
  ).map((r) => r.action);

beforeAll(async () => {
  useGenerousRateLimits();
  for (const [t, name] of [
    [tenantA, 'Tenant A'],
    [tenantB, 'Tenant B'],
  ] as const) {
    await owner.query(`INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3)`, [
      t.id,
      name,
      t.host.split('.')[0],
    ]);
    await owner.query(
      `INSERT INTO tenant_settings ("tenantId", "idleTimeoutMinutes", "sessionMaxDays", "refreshTokenDays")
       VALUES ($1, NULL, 30, 7)`,
      [t.id],
    );
  }
  await owner.query(
    `INSERT INTO roles (id, "tenantId", key, name) VALUES ($1, $2, 'r', 'Tester')`,
    [roleA, tenantA.id],
  );
  await owner.query(
    `INSERT INTO role_permissions ("tenantId", "roleId", "permissionId")
     SELECT $1, $2, id FROM permissions WHERE key = 'dashboard.view'`,
    [tenantA.id, roleA],
  );
  await owner.query(
    `INSERT INTO org_departments (id, "tenantId", code, name) VALUES ($1, $2, 'D', 'Dept')`,
    [deptA, tenantA.id],
  );
  await owner.query(
    `INSERT INTO org_positions (id, "tenantId", "departmentId", "roleId", code, name)
     VALUES ($1, $2, $3, $4, 'P', 'Position')`,
    [positionA, tenantA.id, deptA, roleA],
  );
  app = await createApp();
});

afterAll(async () => {
  await app.close();
  const ids = [tenantA.id, tenantB.id];
  const client = await owner.connect();
  try {
    // audit_logs is append-only; the owner role lifts the trigger just for this cleanup.
    await client.query(`ALTER TABLE audit_logs DISABLE TRIGGER USER`);
    await client.query(`DELETE FROM audit_logs WHERE "tenantId" = ANY($1)`, [ids]);
    await client.query(`ALTER TABLE audit_logs ENABLE TRIGGER USER`);
    for (const table of [
      'sessions',
      'user_roles',
      'role_permissions',
      'users',
      'org_positions',
      'org_departments',
      'roles',
      'tenant_settings',
    ]) {
      await client.query(`DELETE FROM ${table} WHERE "tenantId" = ANY($1)`, [ids]);
    }
    await client.query(`DELETE FROM tenants WHERE id = ANY($1)`, [ids]);
  } finally {
    client.release();
  }
  await owner.end();
});

describe('login', () => {
  it('signs in, sets an httpOnly SameSite=Strict cookie scoped to the auth path, and stores only a hash', async () => {
    const user = await createUser(tenantA.id);
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Host', tenantA.host)
      .send({ email: user.email.toUpperCase(), password: PASSWORD });

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(typeof body.accessToken).toBe('string');
    expect(body).not.toHaveProperty('refreshToken');

    const setCookie = (res.headers['set-cookie'] as unknown as string[])[0];
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
    expect(setCookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(setCookie).not.toMatch(/;\s*Secure/i); // development: plain HTTP

    const raw = cookieValue([setCookie]);
    const [session] = await q<{ refreshTokenHash: string }>(
      `SELECT "refreshTokenHash" FROM sessions WHERE "userId" = $1`,
      [user.id],
    );
    expect(session.refreshTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(session.refreshTokenHash).not.toContain(raw);

    const [row] = await q<{ lastLoginAt: Date | null }>(
      `SELECT "lastLoginAt" FROM users WHERE id = $1`,
      [user.id],
    );
    expect(row.lastLoginAt).not.toBeNull();
    expect(await auditActions(user.id)).toContain('auth.login.success');
  });

  it('gives the same generic error for a wrong password and an unknown email', async () => {
    const user = await createUser(tenantA.id);
    const wrong = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Host', tenantA.host)
      .send({ email: user.email, password: 'nope' });
    const unknown = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Host', tenantA.host)
      .send({ email: `ghost-${suffix}@auth.test`, password: 'nope' });

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect((wrong.body as { message: string }).message).toBe('Invalid credentials');
    expect((unknown.body as { message: string }).message).toBe('Invalid credentials');
    expect(await auditActions(user.id)).toContain('auth.login.failure');
  });

  it('locks the account after repeated failures, then lets it in again once the lock expires', async () => {
    const user = await createUser(tenantA.id);
    for (let i = 0; i < 5; i++)
      expect((await login(tenantA.host, user.email, 'bad')).status).toBe(401);

    // Locked: even the right password is refused, with the same message.
    const locked = await login(tenantA.host, user.email);
    expect(locked.status).toBe(401);
    expect(locked.cookie).toBe('');
    expect(await auditActions(user.id)).toContain('auth.login.lockout');

    await q(`UPDATE users SET "lockedUntil" = now() - interval '1 minute' WHERE id = $1`, [
      user.id,
    ]);
    expect((await login(tenantA.host, user.email)).status).toBe(200);
    const [row] = await q<{ failedLoginCount: number; lockedUntil: Date | null }>(
      `SELECT "failedLoginCount", "lockedUntil" FROM users WHERE id = $1`,
      [user.id],
    );
    expect(row).toEqual({ failedLoginCount: 0, lockedUntil: null });
  });

  it('refuses a disabled user', async () => {
    const user = await createUser(tenantA.id, { status: 'DISABLED' });
    expect((await login(tenantA.host, user.email)).status).toBe(401);
  });

  it('does not let a user from one tenant sign in on another tenant host', async () => {
    const user = await createUser(tenantA.id);
    expect((await login(tenantB.host, user.email)).status).toBe(401);
  });

  it('refuses a host that is not a known tenant', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Host', `nobody-${suffix}.${BASE_DOMAIN}`)
      .send({ email: 'a@b.com', password: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('access control', () => {
  it('protects every route by default and leaves health public', async () => {
    const server = app.getHttpServer();
    expect((await request(server).get('/api/v1/auth/me').set('Host', tenantA.host)).status).toBe(
      401,
    );
    expect((await me(tenantA.host, 'garbage')).status).toBe(401);
    expect((await request(server).get('/api/v1/health')).status).toBe(200);
  });

  it('returns the profile with permissions, branches and tenant from /me', async () => {
    const user = await createUser(tenantA.id, { positionId: positionA });
    await q(`INSERT INTO user_roles ("tenantId", "userId", "roleId") VALUES ($1, $2, $3)`, [
      tenantA.id,
      user.id,
      roleA,
    ]);
    const { accessToken } = await login(tenantA.host, user.email);
    const res = await me(tenantA.host, accessToken);

    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown> & {
      user: Record<string, unknown>;
      tenant: { name: string };
      permissions: string[];
      position: { name: string };
      department: { name: string };
    };
    expect(body.permissions).toEqual(['dashboard.view']);
    expect(body.tenant.name).toBe('Tenant A');
    expect(body.position.name).toBe('Position');
    expect(body.department.name).toBe('Dept');
    expect(body.user.email).toBe(user.email);
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|refreshTokenHash/);
  });

  it("rejects tenant A's access token on tenant B's host", async () => {
    const user = await createUser(tenantA.id);
    const { accessToken } = await login(tenantA.host, user.email);
    expect((await me(tenantA.host, accessToken)).status).toBe(200);
    expect((await me(tenantB.host, accessToken)).status).toBe(401);
  });

  it("rejects tenant A's refresh cookie on tenant B's host", async () => {
    const user = await createUser(tenantA.id);
    const { cookie } = await login(tenantA.host, user.email);
    expect((await post('refresh', tenantB.host, cookie)).status).toBe(401);
    // And it was not burned by the attempt: it still works on its own tenant.
    expect((await post('refresh', tenantA.host, cookie)).status).toBe(200);
  });

  it('blocks a disabled user immediately, even with a valid access token', async () => {
    const user = await createUser(tenantA.id);
    const { accessToken, cookie } = await login(tenantA.host, user.email);
    await q(`UPDATE users SET status = 'DISABLED' WHERE id = $1`, [user.id]);
    expect((await me(tenantA.host, accessToken)).status).toBe(401);
    expect((await post('refresh', tenantA.host, cookie)).status).toBe(401);
  });

  it('blocks a suspended tenant for login, refresh and valid access tokens', async () => {
    const user = await createUser(tenantB.id);
    const { accessToken, cookie } = await login(tenantB.host, user.email);
    expect((await me(tenantB.host, accessToken)).status).toBe(200);

    await q(`UPDATE tenants SET status = 'SUSPENDED' WHERE id = $1`, [tenantB.id]);
    try {
      expect((await login(tenantB.host, user.email)).status).not.toBe(200);
      expect((await post('refresh', tenantB.host, cookie)).status).not.toBe(200);
      expect((await me(tenantB.host, accessToken)).status).not.toBe(200);
    } finally {
      await q(`UPDATE tenants SET status = 'ACTIVE' WHERE id = $1`, [tenantB.id]);
    }
    expect((await me(tenantB.host, accessToken)).status).toBe(200);
  });
});

describe('refresh', () => {
  it('rotates the refresh token and links the old session to the new one', async () => {
    const user = await createUser(tenantA.id);
    const first = await login(tenantA.host, user.email);
    const res = await post('refresh', tenantA.host, first.cookie);

    expect(res.status).toBe(200);
    const next = cookieValue(res.headers['set-cookie'] as unknown as string[]);
    expect(next).not.toBe('');
    expect(next).not.toBe(first.cookie);
    expect((await me(tenantA.host, (res.body as { accessToken: string }).accessToken)).status).toBe(
      200,
    );

    const sessions = await q<{
      revokedAt: Date | null;
      revokedReason: string | null;
      replacedById: string | null;
      id: string;
    }>(
      `SELECT id, "revokedAt", "revokedReason", "replacedById" FROM sessions WHERE "userId" = $1 ORDER BY "createdAt"`,
      [user.id],
    );
    expect(sessions).toHaveLength(2);
    expect(sessions[0].revokedAt).not.toBeNull();
    expect(sessions[0].revokedReason).toBe('rotated');
    expect(sessions[0].replacedById).toBe(sessions[1].id);
    expect(sessions[1].revokedAt).toBeNull();
  });

  it('keeps the absolute expiry fixed while sliding the refresh window', async () => {
    const user = await createUser(tenantA.id);
    const first = await login(tenantA.host, user.email);
    await post('refresh', tenantA.host, first.cookie);
    const rows = await q<{ absoluteExpiresAt: Date }>(
      `SELECT "absoluteExpiresAt" FROM sessions WHERE "userId" = $1`,
      [user.id],
    );
    expect(new Set(rows.map((r) => r.absoluteExpiresAt.getTime())).size).toBe(1);
  });

  it('revokes the whole chain and audits it when a replaced token is reused', async () => {
    const user = await createUser(tenantA.id);
    const first = await login(tenantA.host, user.email);
    const second = await post('refresh', tenantA.host, first.cookie);
    const newest = cookieValue(second.headers['set-cookie'] as unknown as string[]);

    // The attacker replays the first (already replaced) token.
    expect((await post('refresh', tenantA.host, first.cookie)).status).toBe(401);
    // The chain is dead: the legitimate newest token no longer works either.
    expect((await post('refresh', tenantA.host, newest)).status).toBe(401);

    const live = await q(`SELECT id FROM sessions WHERE "userId" = $1 AND "revokedAt" IS NULL`, [
      user.id,
    ]);
    expect(live).toHaveLength(0);
    expect(await auditActions(user.id)).toContain('auth.refresh.reuse');
  });

  it('treats two parallel uses of one token as reuse: exactly one wins', async () => {
    const user = await createUser(tenantA.id);
    const { cookie } = await login(tenantA.host, user.email);
    const results = await Promise.all([
      post('refresh', tenantA.host, cookie),
      post('refresh', tenantA.host, cookie),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses[0]).toBe(200);
    expect(statuses[1]).toBe(401);
  });

  it('requires the CSRF header on refresh, logout and logout-all', async () => {
    const user = await createUser(tenantA.id);
    const { cookie } = await login(tenantA.host, user.email);
    for (const path of ['refresh', 'logout', 'logout-all']) {
      const res = await post(path, tenantA.host, cookie, false);
      expect(res.status, path).toBe(403);
    }
    // Nothing was revoked by the rejected requests.
    expect((await post('refresh', tenantA.host, cookie)).status).toBe(200);
  });

  it('rejects a missing, malformed or unknown refresh cookie and clears it', async () => {
    expect((await post('refresh', tenantA.host)).status).toBe(401);
    const res = await post('refresh', tenantA.host, 'not-a-real-token');
    expect(res.status).toBe(401);
    expect((res.headers['set-cookie'] as unknown as string[]).join(';')).toMatch(
      new RegExp(`${COOKIE}=;`),
    );
  });

  it('rejects an expired refresh token (sliding limit)', async () => {
    const user = await createUser(tenantA.id);
    const { cookie } = await login(tenantA.host, user.email);
    await q(`UPDATE sessions SET "expiresAt" = now() - interval '1 second' WHERE "userId" = $1`, [
      user.id,
    ]);
    expect((await post('refresh', tenantA.host, cookie)).status).toBe(401);
  });

  it('rejects a session past its absolute limit', async () => {
    const user = await createUser(tenantA.id);
    const { cookie } = await login(tenantA.host, user.email);
    await q(
      `UPDATE sessions SET "expiresAt" = now() - interval '1 second', "absoluteExpiresAt" = now() - interval '1 second' WHERE "userId" = $1`,
      [user.id],
    );
    expect((await post('refresh', tenantA.host, cookie)).status).toBe(401);
  });

  it('applies the idle timeout only when the tenant configures one', async () => {
    const user = await createUser(tenantA.id);
    const { cookie } = await login(tenantA.host, user.email);
    await q(`UPDATE sessions SET "lastUsedAt" = now() - interval '2 hours' WHERE "userId" = $1`, [
      user.id,
    ]);

    // ACR-style tenant: no idle timeout, so a long gap is fine.
    const ok = await post('refresh', tenantA.host, cookie);
    expect(ok.status).toBe(200);
    const next = cookieValue(ok.headers['set-cookie'] as unknown as string[]);

    await q(`UPDATE tenant_settings SET "idleTimeoutMinutes" = 30 WHERE "tenantId" = $1`, [
      tenantA.id,
    ]);
    try {
      await q(
        `UPDATE sessions SET "lastUsedAt" = now() - interval '2 hours' WHERE "userId" = $1 AND "revokedAt" IS NULL`,
        [user.id],
      );
      expect((await post('refresh', tenantA.host, next)).status).toBe(401);
    } finally {
      await q(`UPDATE tenant_settings SET "idleTimeoutMinutes" = NULL WHERE "tenantId" = $1`, [
        tenantA.id,
      ]);
    }
  });
});

describe('logout', () => {
  it('revokes the session at once: the access token and refresh token both stop working', async () => {
    const user = await createUser(tenantA.id);
    const { accessToken, cookie } = await login(tenantA.host, user.email);
    expect((await me(tenantA.host, accessToken)).status).toBe(200);

    const res = await post('logout', tenantA.host, cookie);
    expect(res.status).toBe(204);
    expect((res.headers['set-cookie'] as unknown as string[]).join(';')).toMatch(
      new RegExp(`${COOKIE}=;`),
    );
    expect((await me(tenantA.host, accessToken)).status).toBe(401);
    expect((await post('refresh', tenantA.host, cookie)).status).toBe(401);
    expect(await auditActions(user.id)).toContain('auth.logout');
  });

  it('logs out without a cookie as a no-op', async () => {
    expect((await post('logout', tenantA.host)).status).toBe(204);
  });

  it('logout-all ends every session of the user, and only that user', async () => {
    const user = await createUser(tenantA.id);
    const other = await createUser(tenantA.id);
    const one = await login(tenantA.host, user.email);
    const two = await login(tenantA.host, user.email);
    const bystander = await login(tenantA.host, other.email);

    expect((await post('logout-all', tenantA.host, one.cookie)).status).toBe(204);

    expect((await me(tenantA.host, one.accessToken)).status).toBe(401);
    expect((await me(tenantA.host, two.accessToken)).status).toBe(401);
    expect((await post('refresh', tenantA.host, two.cookie)).status).toBe(401);
    expect((await me(tenantA.host, bystander.accessToken)).status).toBe(200);
    expect(await auditActions(user.id)).toContain('auth.logout_all');
  });
});

describe('rate limiting', () => {
  it('answers 429 once the login limit is exceeded', async () => {
    const previous = process.env.THROTTLE_LOGIN_LIMIT;
    process.env.THROTTLE_LOGIN_LIMIT = '3';
    const limited = await createApp();
    process.env.THROTTLE_LOGIN_LIMIT = previous;
    try {
      const attempt = () =>
        request(limited.getHttpServer())
          .post('/api/v1/auth/login')
          .set('Host', tenantA.host)
          .send({ email: `rate-${suffix}@auth.test`, password: 'x' });
      const statuses: number[] = [];
      for (let i = 0; i < 5; i++) statuses.push((await attempt()).status);
      expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
      expect(statuses.slice(3)).toEqual([429, 429]);
    } finally {
      await limited.close();
    }
  });
});
