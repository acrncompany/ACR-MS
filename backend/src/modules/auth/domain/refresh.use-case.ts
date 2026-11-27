import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../core/config/app-config.js';
import { UnauthorizedError } from '../../../core/errors/app-error.js';
import { utcNow } from '../../../core/utils/clock.js';
import { RecordAuditUseCase } from '../../audit/domain/record-audit.use-case.js';
import { GetSessionPolicyUseCase } from '../../tenant/domain/get-tenant.use-cases.js';
import { FindUserByIdUseCase } from '../../user/domain/find-user-by-id.use-case.js';
import { AUTH_REQUIRED, AuthResult, ClientContext } from './auth.types.js';
import { RefreshTokens } from './refresh-tokens.js';
import { SessionEntity, SessionRepository } from './session.repository.js';
import { TokenIssuer } from './token-issuer.js';

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/**
 * Exchanges a refresh token for a new access token AND a new refresh token (rotation). The old
 * session is marked replaced. Presenting a replaced token again means it leaked, so the whole
 * chain is revoked and the event audited.
 */
@Injectable()
export class RefreshUseCase {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly refreshTokens: RefreshTokens,
    private readonly tokens: TokenIssuer,
    private readonly findUserById: FindUserByIdUseCase,
    private readonly getPolicy: GetSessionPolicyUseCase,
    private readonly audit: RecordAuditUseCase,
    private readonly config: AppConfig,
  ) {}

  async execute(rawToken: string | undefined, client: ClientContext): Promise<AuthResult> {
    if (!rawToken) throw new UnauthorizedError(AUTH_REQUIRED);

    const now = utcNow();
    // Scoped to the tenant resolved from the host, so another tenant's token finds nothing.
    const session = await this.sessions.findByTokenHash(this.refreshTokens.hash(rawToken));
    if (!session) throw new UnauthorizedError(AUTH_REQUIRED);

    if (session.revokedAt) {
      // Revoked by rotation = a stale token is being replayed. Revoked by logout = just stale.
      if (session.replacedById) await this.handleReuse(session, client, now);
      throw new UnauthorizedError(AUTH_REQUIRED);
    }

    if (session.expiresAt <= now || session.absoluteExpiresAt <= now) {
      await this.sessions.revoke(session.id, 'expired', now);
      throw new UnauthorizedError(AUTH_REQUIRED);
    }

    const [user, policy] = await Promise.all([
      this.findUserById.execute(session.userId),
      this.getPolicy.execute(),
    ]);
    if (!user || user.status !== 'ACTIVE') {
      await this.sessions.revoke(session.id, 'user_inactive', now);
      throw new UnauthorizedError(AUTH_REQUIRED);
    }

    const idleMinutes = policy.idleTimeoutMinutes;
    if (
      idleMinutes !== null &&
      now.getTime() - session.lastUsedAt.getTime() > idleMinutes * MINUTE_MS
    ) {
      await this.sessions.revoke(session.id, 'idle_timeout', now);
      throw new UnauthorizedError(AUTH_REQUIRED);
    }

    const next = this.refreshTokens.generate();
    // Sliding window, never beyond the absolute cap.
    const expiresAt = new Date(
      Math.min(
        now.getTime() + policy.refreshTokenDays * DAY_MS,
        session.absoluteExpiresAt.getTime(),
      ),
    );
    const rotated = await this.sessions.rotate(
      session.id,
      {
        userId: session.userId,
        refreshTokenHash: next.hash,
        userAgent: client.userAgent,
        ip: client.ip,
        expiresAt,
        absoluteExpiresAt: session.absoluteExpiresAt,
        lastUsedAt: now,
      },
      now,
    );
    if (!rotated) {
      // A parallel request used this token first: same as a replay.
      await this.handleReuse(session, client, now);
      throw new UnauthorizedError(AUTH_REQUIRED);
    }

    const accessToken = await this.tokens.issue({
      userId: session.userId,
      tenantId: session.tenantId,
      sessionId: rotated.id,
    });
    return {
      accessToken,
      expiresIn: this.config.jwtExpiresInSeconds,
      refreshToken: next.token,
      refreshExpiresAt: expiresAt,
    };
  }

  private async handleReuse(
    session: SessionEntity,
    client: ClientContext,
    now: Date,
  ): Promise<void> {
    const revoked = await this.sessions.revokeChain(session.id, 'reuse_detected', now);
    await this.audit.execute({
      action: 'auth.refresh.reuse',
      entity: 'session',
      entityId: session.id,
      userId: session.userId,
      changes: { revokedSessions: revoked },
      ip: client.ip,
    });
  }
}
