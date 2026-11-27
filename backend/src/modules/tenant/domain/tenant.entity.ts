export interface TenantEntity {
  id: string;
  name: string;
  slug: string;
}

/** Tenant details shown to a signed-in user, plus its session policy. */
export interface TenantProfile extends TenantEntity {
  status: 'ACTIVE' | 'SUSPENDED';
  branding: Record<string, unknown>;
  defaultLocale: string;
}

/** Session limits from tenant_settings. */
export interface SessionPolicy {
  /** Sliding lifetime of a refresh token. */
  refreshTokenDays: number;
  /** Hard cap on a session, never extended. */
  sessionMaxDays: number;
  /** null = no idle logout. */
  idleTimeoutMinutes: number | null;
}
