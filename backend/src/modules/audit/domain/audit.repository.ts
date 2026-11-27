import type { TenantTransaction } from '../../../core/database/prisma.service.js';

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string | null;
  /** Actor; null for anonymous or system actions (e.g. a login for an unknown email). */
  userId?: string | null;
  branchId?: string | null;
  /** What changed. NEVER put secrets (passwords, credentials, tokens) in here. */
  changes?: Record<string, unknown> | null;
  ip?: string | null;
}

export interface AuditRow {
  id: string;
  at: Date;
  action: string;
  userId: string | null;
  userName: string | null;
  entityId: string | null;
  changes: Record<string, unknown> | null;
}

export abstract class AuditRepository {
  /** Appends one row to audit_logs (append-only). Runs in the current tenant context. */
  abstract record(entry: AuditEntry): Promise<void>;
  /** Same, but inside the caller's transaction, so the row commits or rolls back with the change. */
  abstract recordIn(tx: TenantTransaction, entry: AuditEntry): Promise<void>;
  /** Newest first. */
  abstract listForEntity(
    entity: string,
    entityId: string,
    actions: string[] | null,
    limit: number,
  ): Promise<AuditRow[]>;
  /** Rows by `userId` with one of `actions` since `since`, newest first. */
  abstract listByActorSince(userId: string, actions: string[], since: Date): Promise<AuditRow[]>;
  abstract countByActor(userId: string): Promise<number>;
}
