import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenClaims, TokenIssuer } from '../domain/token-issuer.js';

@Injectable()
export class JwtTokenIssuer extends TokenIssuer {
  constructor(private readonly jwt: JwtService) {
    super();
  }

  issue(claims: TokenClaims): Promise<string> {
    return this.jwt.signAsync({ sub: claims.userId, tid: claims.tenantId });
  }
}
