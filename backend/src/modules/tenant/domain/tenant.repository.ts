import { TenantEntity } from './tenant.entity.js';

export abstract class TenantRepository {
  /** Returns the tenant only when it exists, is not deleted, and is ACTIVE. */
  abstract findActiveBySlug(slug: string): Promise<TenantEntity | null>;
}
