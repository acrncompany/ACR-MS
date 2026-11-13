import { describe, expect, it } from 'vitest';
import { durationToSeconds, parseEnv } from './env.schema.js';

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(32),
  TENANT_BASE_DOMAIN: 'localhost',
  CORS_ORIGINS: 'http://localhost:4200, http://localhost:4300',
};

describe('parseEnv', () => {
  it('defaults the access token lifetime to 15 minutes', () => {
    const env = parseEnv(valid);
    expect(env.JWT_EXPIRES_IN).toBe('15m');
    expect(durationToSeconds(env.JWT_EXPIRES_IN)).toBe(900);
  });

  it('splits CORS origins', () => {
    expect(parseEnv(valid).CORS_ORIGINS).toEqual([
      'http://localhost:4200',
      'http://localhost:4300',
    ]);
  });

  it('rejects a missing JWT secret (no fallback)', () => {
    const rest: Record<string, string | undefined> = { ...valid };
    delete rest['JWT_SECRET'];
    expect(() => parseEnv(rest)).toThrow(/JWT_SECRET/);
  });

  it('rejects a JWT secret shorter than 32 characters', () => {
    expect(() => parseEnv({ ...valid, JWT_SECRET: 'short' })).toThrow(/at least 32/);
  });

  it('rejects the example placeholder as a secret', () => {
    expect(() => parseEnv({ ...valid, JWT_SECRET: 'change-me-' + 'x'.repeat(30) })).toThrow(
      /placeholder/,
    );
  });

  it('rejects a malformed token lifetime', () => {
    expect(() => parseEnv({ ...valid, JWT_EXPIRES_IN: 'soon' })).toThrow(/JWT_EXPIRES_IN/);
  });
});
