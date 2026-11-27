import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  // No default on purpose: the secret must come from the environment.
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .refine(
      (value) => !/^(change-?me|<)/i.test(value),
      'JWT_SECRET must not be the example placeholder',
    ),
  /** Access token lifetime, e.g. 900s, 15m, 1h, 1d. */
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, 'JWT_EXPIRES_IN must look like 15m, 1h or 900s')
    .default('15m'),
  TENANT_BASE_DOMAIN: z.string().min(1),
  /**
   * Master key for field-level encryption of client portal credentials: 32 random bytes,
   * base64. No default, never committed. Per-tenant keys are derived from it with HKDF.
   * Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   */
  CREDENTIAL_MASTER_KEY: z
    .string()
    .min(1, 'CREDENTIAL_MASTER_KEY is required')
    .refine((value) => Buffer.from(value, 'base64').length === 32, {
      message: 'CREDENTIAL_MASTER_KEY must be 32 random bytes encoded as base64',
    }),
  /** Id of the derived key used to encrypt NEW values (stored per row, so keys can be rotated). */
  CREDENTIAL_KEY_ID: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,32}$/)
    .default('v1'),
  /** Folder for uploaded files (employee documents). Back it up; never serve it directly. */
  FILE_STORAGE_DIR: z.string().min(1).default('./storage'),
  /** Name of the httpOnly refresh-token cookie. */
  REFRESH_COOKIE_NAME: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .default('acrms_rt'),
  /** Cookie path: the refresh token is only sent to the auth endpoints. */
  REFRESH_COOKIE_PATH: z.string().startsWith('/').default('/api/v1/auth'),
  /** Failed logins before the account is locked. */
  LOGIN_MAX_FAILURES: z.coerce.number().int().min(1).default(5),
  /** How long an account stays locked after too many failures. */
  LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).default(15),
  /** Requests per THROTTLE_TTL_SECONDS and IP: login, refresh, and everything else. */
  THROTTLE_TTL_SECONDS: z.coerce.number().int().min(1).default(60),
  THROTTLE_LOGIN_LIMIT: z.coerce.number().int().min(1).default(10),
  THROTTLE_REFRESH_LIMIT: z.coerce.number().int().min(1).default(30),
  THROTTLE_DEFAULT_LIMIT: z.coerce.number().int().min(1).default(300),
  /** Reverse proxies in front of the app (for the real client IP). 0 = none. */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  CORS_ORIGINS: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
});

const UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86400 } as const;

/** Converts a validated duration such as "15m" to seconds. */
export function durationToSeconds(value: string): number {
  const unit = value.slice(-1) as keyof typeof UNIT_SECONDS;
  return Number.parseInt(value.slice(0, -1), 10) * UNIT_SECONDS[unit];
}

export type Env = z.infer<typeof envSchema>;

/** Validates raw environment variables. Throws a readable error listing every problem. */
export function parseEnv(raw: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}
