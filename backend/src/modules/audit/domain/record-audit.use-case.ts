import { isIP } from 'node:net';
import { Injectable } from '@nestjs/common';
import type { TenantTransaction } from '../../../core/database/prisma.service.js';
import { AuditEntry, AuditRepository, AuditRow } from './audit.repository.js';

/** Public entry point other modules use to write audit_logs. */
@Injectable()
export class RecordAuditUseCase {
  constructor(private readonly audit: AuditRepository) {}

  execute(entry: AuditEntry): Promise<void> {
    return this.audit.record(clean(entry));
  }

  /** Writes inside the caller's transaction (the row commits or rolls back with the change). */
  executeIn(tx: TenantTransaction, entry: AuditEntry): Promise<void> {
    return this.audit.recordIn(tx, clean(entry));
  }
}

function clean(entry: AuditEntry): AuditEntry {
  // The column is INET: anything that is not an IP address would make the insert fail.
  const ip = entry.ip && isIP(entry.ip) ? entry.ip : null;
  return { ...entry, ip };
}

/** Audit rows about one entity (e.g. the access log of a client's credentials). */
@Injectable()
export class ListEntityAuditUseCase {
  constructor(private readonly audit: AuditRepository) {}

  execute(
    entity: string,
    entityId: string,
    actions: string[] | null,
    limit = 50,
  ): Promise<AuditRow[]> {
    return this.audit.listForEntity(entity, entityId, actions, limit);
  }
}

/** What a user did since a moment (used for rate limits and reveal blocking). */
@Injectable()
export class ListActorAuditUseCase {
  constructor(private readonly audit: AuditRepository) {}

  execute(userId: string, actions: string[], since: Date): Promise<AuditRow[]> {
    return this.audit.listByActorSince(userId, actions, since);
  }
}

/** Part of the "has history" check before a person may be deleted. */
@Injectable()
export class CountAuditEntriesByUserUseCase {
  constructor(private readonly audit: AuditRepository) {}

  execute(userId: string): Promise<number> {
    return this.audit.countByActor(userId);
  }
}
