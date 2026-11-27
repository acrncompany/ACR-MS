import { Injectable } from '@nestjs/common';
import { utcNow } from '../../../core/utils/clock.js';
import { RecordAuditUseCase } from '../../audit/domain/record-audit.use-case.js';
import { ClientContext } from './auth.types.js';
import { RefreshTokens } from './refresh-tokens.js';
import { SessionRepository } from './session.repository.js';

/**
 * Logout works from the refresh cookie, so it still works after the access token expired.
 * Both use cases are idempotent: an unknown, expired or already revoked token does nothing.
 */
@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly refreshTokens: RefreshTokens,
    private readonly audit: RecordAuditUseCase,
  ) {}

  async execute(rawToken: string | undefined, client: ClientContext): Promise<void> {
    if (!rawToken) return;
    const now = utcNow();
    const session = await this.sessions.findByTokenHash(this.refreshTokens.hash(rawToken));
    if (!session || session.revokedAt) return;

    await this.sessions.revoke(session.id, 'logout', now);
    await this.audit.execute({
      action: 'auth.logout',
      entity: 'session',
      entityId: session.id,
      userId: session.userId,
      ip: client.ip,
    });
  }
}

@Injectable()
export class LogoutAllUseCase {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly refreshTokens: RefreshTokens,
    private readonly audit: RecordAuditUseCase,
  ) {}

  async execute(rawToken: string | undefined, client: ClientContext): Promise<void> {
    if (!rawToken) return;
    const now = utcNow();
    const session = await this.sessions.findByTokenHash(this.refreshTokens.hash(rawToken));
    // Only a live session may end all the others.
    if (!session || session.revokedAt || session.expiresAt <= now) return;

    const revoked = await this.sessions.revokeAllForUser(session.userId, 'logout_all', now);
    await this.audit.execute({
      action: 'auth.logout_all',
      entity: 'user',
      entityId: session.userId,
      userId: session.userId,
      changes: { revokedSessions: revoked },
      ip: client.ip,
    });
  }
}
