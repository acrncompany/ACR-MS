export interface SessionEntity {
  id: string;
  tenantId: string;
  userId: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  replacedById: string | null;
}

export interface NewSession {
  userId: string;
  /** SHA-256 of the refresh token. The token itself is never stored. */
  refreshTokenHash: string;
  userAgent: string | null;
  ip: string | null;
  /** Sliding expiry. */
  expiresAt: Date;
  /** Hard cap, copied unchanged on every rotation. */
  absoluteExpiresAt: Date;
  lastUsedAt: Date;
}

export abstract class SessionRepository {
  abstract create(session: NewSession): Promise<SessionEntity>;
  abstract findByTokenHash(hash: string): Promise<SessionEntity | null>;
  /**
   * One indexed query used on EVERY authenticated request: is the session live (not revoked, not
   * expired) AND is its user ACTIVE AND is its tenant ACTIVE. May move to a cache later.
   */
  abstract findUsable(
    sessionId: string,
    userId: string,
    now: Date,
  ): Promise<{ mustChangePassword: boolean } | null>;
  /**
   * Atomically creates `next` and marks `previousId` revoked and replaced by it. Returns null
   * when `previousId` was already revoked (a parallel refresh won), which the caller treats as
   * token reuse. Nothing is written in that case.
   */
  abstract rotate(previousId: string, next: NewSession, now: Date): Promise<SessionEntity | null>;
  abstract revoke(sessionId: string, reason: string, now: Date): Promise<void>;
  /** Revokes `sessionId` and every session that replaced it. Returns how many were revoked. */
  abstract revokeChain(sessionId: string, reason: string, now: Date): Promise<number>;
  /** Revokes the user's live sessions except `keepSessionId`. Returns how many were revoked. */
  abstract revokeOthers(
    userId: string,
    keepSessionId: string,
    reason: string,
    now: Date,
  ): Promise<number>;
  /** Revokes all live sessions of a user. Returns how many were revoked. */
  abstract revokeAllForUser(userId: string, reason: string, now: Date): Promise<number>;
}
