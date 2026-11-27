import { Injectable } from '@nestjs/common';
import { AppError, NotFoundError, TooManyRequestsError } from '../../../core/errors/app-error.js';
import { utcNow } from '../../../core/utils/clock.js';
import type { Actor } from '../../access/domain/actor.js';
import {
  ListActorAuditUseCase,
  RecordAuditUseCase,
} from '../../audit/domain/record-audit.use-case.js';
import { VerifyUserPasswordUseCase } from '../../auth/domain/password-use-cases.js';
import { CREDENTIAL_AUDIT, type CredentialField } from './credential-fields.js';
import { CredentialsRepository } from './credentials.repository.js';

/** Reveals allowed per user and minute (successful and failed attempts both count). */
export const REVEAL_PER_MINUTE = 5;
/** Wrong passwords within the window that block reveal for that user (not the account). */
export const REVEAL_MAX_FAILURES = 5;
export const REVEAL_WINDOW_MS = 15 * 60_000;
export const REVEAL_BLOCK_MS = 15 * 60_000;

export interface CredentialContext {
  clientId: string;
  /** The client's branch, recorded on the audit row. */
  branchId: string;
  ip: string | null;
}

@Injectable()
export class ListCredentialFieldsUseCase {
  constructor(private readonly credentials: CredentialsRepository) {}

  /** Which fields hold a value. Never the values themselves. */
  execute(clientId: string): Promise<CredentialField[]> {
    return this.credentials.listFields(clientId);
  }
}

/** Write-only: a stored value can be replaced or cleared, never read back through this path. */
@Injectable()
export class SetCredentialUseCase {
  constructor(private readonly credentials: CredentialsRepository) {}

  async execute(
    actor: Actor,
    ctx: CredentialContext,
    field: CredentialField,
    value: string,
  ): Promise<void> {
    const audit = {
      userId: actor.userId,
      branchId: ctx.branchId,
      ip: ctx.ip,
    };
    if (value === '') {
      const removed = await this.credentials.remove(ctx.clientId, field, {
        ...audit,
        action: CREDENTIAL_AUDIT.clear,
        changes: { field },
      });
      if (!removed) throw new NotFoundError('No value is stored for this field');
      return;
    }
    await this.credentials.upsert(ctx.clientId, field, value, actor.userId, {
      ...audit,
      action: CREDENTIAL_AUDIT.update,
      changes: { field },
    });
  }
}

/**
 * Reveal needs the permission (checked by the guard) AND the user's current password
 * (re-authentication). Limits, counted from the audit log so they hold across server instances:
 * at most 5 attempts per minute per user (429), and after 5 wrong passwords within 15 minutes
 * reveal is blocked for that user for 15 minutes with an audit row. The account is never locked.
 */
@Injectable()
export class RevealCredentialUseCase {
  constructor(
    private readonly credentials: CredentialsRepository,
    private readonly verifyPassword: VerifyUserPasswordUseCase,
    private readonly listActorAudit: ListActorAuditUseCase,
    private readonly audit: RecordAuditUseCase,
  ) {}

  async execute(
    actor: Actor,
    ctx: CredentialContext,
    input: { field: CredentialField; password: string; worksheetId: string | null },
  ): Promise<string> {
    const now = utcNow();
    const recent = await this.listActorAudit.execute(
      actor.userId,
      [CREDENTIAL_AUDIT.reveal, CREDENTIAL_AUDIT.denied, CREDENTIAL_AUDIT.blocked],
      new Date(now.getTime() - REVEAL_WINDOW_MS),
    );

    const lastMinute = recent.filter(
      (r) => r.action !== CREDENTIAL_AUDIT.blocked && now.getTime() - r.at.getTime() < 60_000,
    );
    if (lastMinute.length >= REVEAL_PER_MINUTE) {
      throw new TooManyRequestsError('Too many reveal attempts. Wait a minute and try again.');
    }

    const blockedUntil = this.blockedUntil(recent, now);
    if (blockedUntil) {
      throw new AppError(
        'REVEAL_BLOCKED',
        `Reveal is blocked until ${blockedUntil.toISOString()} after too many wrong passwords`,
        429,
      );
    }

    const audit = { userId: actor.userId, branchId: ctx.branchId, ip: ctx.ip };
    if (!(await this.verifyPassword.execute(actor.userId, input.password))) {
      await this.audit.execute({
        ...audit,
        action: CREDENTIAL_AUDIT.denied,
        entity: 'client',
        entityId: ctx.clientId,
        changes: { field: input.field, reason: 'wrong_password' },
      });
      const failures =
        recent.filter((r) => r.action === CREDENTIAL_AUDIT.denied && this.isUnblocked(r, recent))
          .length + 1;
      if (failures >= REVEAL_MAX_FAILURES) {
        await this.audit.execute({
          ...audit,
          action: CREDENTIAL_AUDIT.blocked,
          entity: 'client',
          entityId: ctx.clientId,
          changes: { blockedMinutes: REVEAL_BLOCK_MS / 60_000, failures },
        });
      }
      throw new AppError('INVALID_PASSWORD', 'Your password is incorrect', 403);
    }

    const value = await this.credentials.revealAudited(ctx.clientId, input.field, {
      ...audit,
      action: CREDENTIAL_AUDIT.reveal,
      changes: { field: input.field, worksheetId: input.worksheetId },
    });
    if (value === null) throw new NotFoundError('No value is stored for this field');
    return value;
  }

  /** Until when reveal is blocked, or null. The newest "blocked" marker starts the 15 minutes. */
  private blockedUntil(recent: { action: string; at: Date }[], now: Date): Date | null {
    const marker = recent.find((r) => r.action === CREDENTIAL_AUDIT.blocked);
    if (!marker) return null;
    const until = new Date(marker.at.getTime() + REVEAL_BLOCK_MS);
    return until > now ? until : null;
  }

  /** Failures that happened after the last block ended still count; older ones were consumed. */
  private isUnblocked(row: { at: Date }, recent: { action: string; at: Date }[]): boolean {
    const marker = recent.find((r) => r.action === CREDENTIAL_AUDIT.blocked);
    return !marker || row.at > marker.at;
  }
}
