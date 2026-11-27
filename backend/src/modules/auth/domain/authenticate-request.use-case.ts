import { Injectable } from '@nestjs/common';
import { UnauthorizedError } from '../../../core/errors/app-error.js';
import { utcNow } from '../../../core/utils/clock.js';
import { AUTH_REQUIRED, AuthIdentity } from './auth.types.js';
import { SessionRepository } from './session.repository.js';
import { TokenIssuer } from './token-issuer.js';

/**
 * Turns a bearer token into a trusted identity. The token must be valid, must belong to the
 * tenant the HOST resolved to (a token from another tenant is rejected), and its session must
 * still be live with an ACTIVE user and an ACTIVE tenant, so logout, a disabled user or a
 * suspended tenant take effect immediately instead of after the access token expires.
 */
@Injectable()
export class AuthenticateRequestUseCase {
  constructor(
    private readonly tokens: TokenIssuer,
    private readonly sessions: SessionRepository,
  ) {}

  async execute(token: string, hostTenantId: string): Promise<AuthIdentity> {
    const identity = await this.tokens.verify(token);
    if (!identity || identity.tenantId !== hostTenantId) {
      throw new UnauthorizedError(AUTH_REQUIRED);
    }
    const usable = await this.sessions.findUsable(identity.sessionId, identity.userId, utcNow());
    if (!usable) throw new UnauthorizedError(AUTH_REQUIRED);
    return { ...identity, mustChangePassword: usable.mustChangePassword };
  }
}
