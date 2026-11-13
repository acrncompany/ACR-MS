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
