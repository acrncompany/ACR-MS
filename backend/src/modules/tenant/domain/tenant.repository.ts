import { SessionPolicy, TenantEntity, TenantProfile } from './tenant.entity.js';

export abstract class TenantRepository {
  /** Returns the tenant only when it exists, is not deleted, and is ACTIVE. */
  abstract findActiveBySlug(slug: string): Promise<TenantEntity | null>;
  /** The current tenant's profile (current tenant context). */
  abstract findCurrentProfile(): Promise<TenantProfile | null>;
  /** The current tenant's session limits (defaults apply when no settings row exists). */
  abstract findCurrentSessionPolicy(): Promise<SessionPolicy>;
}
