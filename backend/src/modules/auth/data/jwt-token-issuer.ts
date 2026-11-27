import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthIdentity } from '../domain/auth.types.js';
import { TokenIssuer } from '../domain/token-issuer.js';

const ALGORITHM = 'HS256';

@Injectable()
export class JwtTokenIssuer extends TokenIssuer {
  constructor(private readonly jwt: JwtService) {
    super();
  }

  issue(identity: AuthIdentity): Promise<string> {
    return this.jwt.signAsync(
      { sub: identity.userId, tid: identity.tenantId, sid: identity.sessionId },
      { algorithm: ALGORITHM },
    );
  }

  async verify(token: string): Promise<AuthIdentity | null> {
    try {
      // The algorithm is pinned so a token cannot pick its own (e.g. "none").
      const payload = await this.jwt.verifyAsync<Record<string, unknown>>(token, {
        algorithms: [ALGORITHM],
      });
      const { sub, tid, sid } = payload;
      if (typeof sub !== 'string' || typeof tid !== 'string' || typeof sid !== 'string') {
        return null;
      }
      return { userId: sub, tenantId: tid, sessionId: sid };
    } catch {
      return null;
    }
  }
}
