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
 * End-to-end tests of the People profile (employees and articles): the full profile, the
 * reporting manager, document upload / replace / view, and the database guarantees.
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
  method: 'get' | 'post' | 'put' | 'delete',
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

async function upload(
  path: string,
  user: FixtureUser,
  data: Buffer,
  name = 'scan.pdf',
): Promise<request.Response> {
  return request(app.getHttpServer())
    .post(`/api/v1${path}?fileName=${encodeURIComponent(name)}`)
    .set('Host', A.host)
    .set('Authorization', `Bearer ${await tokenFor(A, user)}`)
    .set('Content-Type', 'application/octet-stream')
    .send(data);
}

const q = async <T extends pg.QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> =>
  (await owner.query<T>(sql, params)).rows;

beforeAll(async () => {
  process.env.THROTTLE_LOGIN_LIMIT = '10000';
  process.env.THROTTLE_REFRESH_LIMIT = '10000';
  process.env.THROTTLE_DEFAULT_LIMIT = '10000';
  A = await createFixture(owner, 'hp-a', BASE_DOMAIN);
  B = await createFixture(owner, 'hp-b', BASE_DOMAIN);
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

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n');
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16),
]);

const profile = {
  firstName: 'Meera',
  lastName: 'Nair',
  email: 'meera@example.com',
  mobNo: '9847000000',
  joinDate: '2026-06-01',
  dateOfBirth: '1999-02-03',
  gender: 'FEMALE',
  maritalStatus: 'SINGLE',
  address: {
    houseName: 'Rose Villa',
    postOffice: 'Thrissur',
    district: 'Thrissur',
    pinCode: '680001',
    state: 'Kerala',
  },
  emergencyContact: { name: 'Raju Nair', relation: 'Father', mobNo: '9847111111' },
  idProofType: 'AADHAAR',
  bank: {
    accountHolder: 'Meera Nair',
    bankName: 'Example Bank',
    accountNumber: '1234567890',
    ifsc: 'exmp0001234',
    branch: 'Thrissur',
  },
};

describe('People profile, articles and documents', () => {
  let managerId: string;
  let articleId: string;
  let employeeId: string;

  it('creates an employee with the full profile and a manager, and an article with the next code of the shared series', async () => {
    const manager = await api('post', '/hr/employees', board, {
      firstName: 'Boss',
      joinDate: '2020-01-01',
    });
    expect(manager.status).toBe(201);
    managerId = manager.body.id;

    const employee = await api('post', '/hr/employees', board, {
      ...profile,
      reportingManagerId: managerId,
    });
    expect(employee.status).toBe(201);
    employeeId = employee.body.id;
    expect(employee.body.reportingManagerName).toBe('Boss');
    expect(employee.body.address.postOffice).toBe('Thrissur');
    expect(employee.body.bank.ifsc).toBe('EXMP0001234');
    expect(employee.body.dateOfBirth).toBe('1999-02-03');

    const article = await api('post', '/hr/articles', board, {
      ...profile,
      firstName: 'Article',
      lastName: 'One',
      reportingManagerId: managerId,
    });
    expect(article.status).toBe(201);
    expect(article.body.code).toMatch(/^[A-Z0-9]+-\d{4}$/);
    // One series: the article continues after the employees (Boss, Meera Nair).
    expect(Number(article.body.code.slice(-4))).toBe(Number(employee.body.code.slice(-4)) + 1);
    articleId = article.body.id;
    expect((await api('get', `/hr/articles/${articleId}`, board)).body.gender).toBe('FEMALE');
    expect((await api('get', '/hr/articles', board)).body.total).toBe(1);
    // Articles and employees are separate: an article id is not an employee.
    expect((await api('get', `/hr/employees/${articleId}`, board)).status).toBe(404);
    expect((await api('get', '/hr/employees/options', board)).body.length).toBeGreaterThan(0);
  });

  it('rejects an unknown reporting manager and unknown keys', async () => {
    const bad = await api('post', '/hr/articles', board, {
      firstName: 'X',
      joinDate: '2026-01-01',
      reportingManagerId: articleId,
    });
    expect(bad.status).toBe(400);
    const unknown = await api('post', '/hr/employees', board, {
      firstName: 'Y',
      joinDate: '2026-01-01',
      idProofFileKey: 'x',
    });
    expect(unknown.status).toBe(400);
  });

  it('uploads, replaces and serves a document; never exposes the storage key', async () => {
    const up = await upload(`/hr/employees/${employeeId}/documents/id-proof`, board, PDF);
    expect(up.status).toBe(201);
    const detail = await api('get', `/hr/employees/${employeeId}`, board);
    expect(detail.body.documents.idProof).toEqual({
      fileName: 'scan.pdf',
      mime: 'application/pdf',
    });
    expect(JSON.stringify(detail.body)).not.toContain('FileKey');
    const file = await request(app.getHttpServer())
      .get(`/api/v1/hr/employees/${employeeId}/documents/id-proof`)
      .set('Host', A.host)
      .set('Authorization', `Bearer ${await tokenFor(A, board)}`);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toContain('application/pdf');
    const again = await upload(
      `/hr/employees/${employeeId}/documents/id-proof`,
      board,
      PNG,
      'a.png',
    );
    expect(again.status).toBe(201);
    expect(again.body.mime).toBe('image/png');
    const audit = await q(
      `SELECT 1 FROM audit_logs WHERE "entityId" = $1 AND action = 'hr.employee.document.upload'`,
      [employeeId],
    );
    expect(audit).toHaveLength(2);
  });

  it('refuses files over 2 MB, the wrong type, and a missing document', async () => {
    const big = Buffer.concat([PDF, Buffer.alloc(2 * 1024 * 1024)]);
    expect((await upload(`/hr/articles/${articleId}/documents/resume`, board, big)).status).toBe(
      413,
    );
    const exe = Buffer.from('MZ not allowed');
    expect((await upload(`/hr/articles/${articleId}/documents/resume`, board, exe)).status).toBe(
      400,
    );
    // A PNG is fine for an ID proof but not for a resume.
    expect((await upload(`/hr/articles/${articleId}/documents/resume`, board, PNG)).status).toBe(
      400,
    );
    const none = await api('get', `/hr/articles/${articleId}/documents/passbook`, board);
    expect(none.status).toBe(404);
  });

  it('needs hr.create to upload and hr.view to open', async () => {
    expect((await upload(`/hr/employees/${employeeId}/documents/resume`, plain, PDF)).status).toBe(
      403,
    );
    expect((await api('get', `/hr/employees/${employeeId}/documents/id-proof`, plain)).status).toBe(
      403,
    );
  });

  it('adds any number of additional documents and serves each one', async () => {
    const send = async (path: string, user: FixtureUser, data: Buffer, title: string) =>
      request(app.getHttpServer())
        .post(`/api/v1${path}?fileName=cert.pdf&title=${encodeURIComponent(title)}`)
        .set('Host', A.host)
        .set('Authorization', `Bearer ${await tokenFor(A, user)}`)
        .set('Content-Type', 'application/octet-stream')
        .send(data);
    const first = await send(
      `/hr/employees/${employeeId}/additional-documents`,
      board,
      PDF,
      'Degree',
    );
    const second = await send(`/hr/employees/${employeeId}/additional-documents`, board, PNG, '');
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.title).toBe('Degree');
    const detail = await api('get', `/hr/employees/${employeeId}`, board);
    expect(detail.body.additionalDocuments).toHaveLength(2);
    expect(JSON.stringify(detail.body)).not.toContain('fileKey');
    const file = await request(app.getHttpServer())
      .get(`/api/v1/hr/employees/${employeeId}/additional-documents/${first.body.id}`)
      .set('Host', A.host)
      .set('Authorization', `Bearer ${await tokenFor(A, board)}`);
    expect(file.status).toBe(200);
    // Another record's id does not open it.
    const other = await api(
      'get',
      `/hr/articles/${articleId}/additional-documents/${first.body.id}`,
      board,
    );
    expect(other.status).toBe(404);
    expect(
      (await send(`/hr/employees/${employeeId}/additional-documents`, plain, PDF, 'x')).status,
    ).toBe(403);
    expect(
      (
        await send(
          `/hr/employees/${employeeId}/additional-documents`,
          board,
          Buffer.from('MZ'),
          'x',
        )
      ).status,
    ).toBe(400);
  });

  it('keeps articles under row-level security with a permanent code', async () => {
    const rls = await q<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'articles'`,
    );
    expect(rls[0]?.relrowsecurity && rls[0]?.relforcerowsecurity).toBe(true);
    await expect(
      q(`UPDATE articles SET code = 'ZZZ-9999' WHERE id = $1`, [articleId]),
    ).rejects.toThrow(/permanent/);
    expect((await api('get', '/hr/articles', boardB, undefined, B)).body.total).toBe(0);
  });

  it('edits an employee and an article; the code never changes; no reporting cycles', async () => {
    const before = await api('get', `/hr/employees/${employeeId}`, board);
    const edited = await api('put', `/hr/employees/${employeeId}`, board, {
      ...profile,
      firstName: 'Meera',
      lastName: 'Menon',
      mobNo: '9847222222',
      reportingManagerId: managerId,
    });
    expect(edited.status).toBe(200);
    expect(edited.body.code).toBe(before.body.code);
    expect(edited.body.name).toBe('Meera Menon');
    expect(edited.body.mobNo).toBe('9847222222');
    expect((await api('get', `/hr/employees/${employeeId}`, board)).body.lastName).toBe('Menon');
    // A code or tenantId in the body is refused, like on create.
    const withCode = await api('put', `/hr/employees/${employeeId}`, board, {
      ...profile,
      code: 'X-1',
    });
    expect(withCode.status).toBe(400);
    // Needs hr.edit; unknown id is 404.
    expect((await api('put', `/hr/employees/${employeeId}`, plain, profile)).status).toBe(403);
    expect(
      (await api('put', `/hr/employees/${'0190d8a0-0000-7000-8000-000000000000'}`, board, profile))
        .status,
    ).toBe(404);
    // Nobody reports to themselves, directly or through someone who reports to them.
    expect(
      (await api('put', `/hr/employees/${employeeId}`, board, {
        ...profile,
        reportingManagerId: employeeId,
      })).status,
    ).toBe(400);
    expect(
      (await api('put', `/hr/employees/${managerId}`, board, {
        ...profile,
        firstName: 'Boss',
        reportingManagerId: employeeId,
      })).status,
    ).toBe(400);
    const article = await api('put', `/hr/articles/${articleId}`, board, {
      ...profile,
      firstName: 'Article',
      lastName: '',
      reportingManagerId: managerId,
    });
    expect(article.status).toBe(200);
    expect(article.body.name).toBe('Article');
    const audit = await q(`SELECT 1 FROM audit_logs WHERE action = 'hr.employee.update'`);
    expect(audit.length).toBeGreaterThan(0);
  });

  it('deletes a record for good (development), with its documents; not a manager of others', async () => {
    expect((await api('delete', `/hr/articles/${articleId}`, plain)).status).toBe(403);
    // The manager still has people reporting to them.
    expect((await api('delete', `/hr/employees/${managerId}`, board)).status).toBe(409);
    expect((await api('delete', `/hr/articles/${articleId}`, board)).status).toBe(204);
    expect((await api('get', `/hr/articles/${articleId}`, board)).status).toBe(404);
    expect((await api('delete', `/hr/articles/${articleId}`, board)).status).toBe(404);
    expect((await api('delete', `/hr/employees/${employeeId}`, board)).status).toBe(204);
    expect((await api('delete', `/hr/employees/${managerId}`, board)).status).toBe(204);
    expect(
      await q(`SELECT 1 FROM person_documents WHERE "employeeId" = $1`, [employeeId]),
    ).toHaveLength(0);
    const audit = await q(`SELECT 1 FROM audit_logs WHERE action = 'hr.article.delete'`);
    expect(audit.length).toBeGreaterThan(0);
  });
});
