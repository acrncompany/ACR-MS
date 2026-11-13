export interface TokenClaims {
  userId: string;
  tenantId: string;
}

export abstract class TokenIssuer {
  abstract issue(claims: TokenClaims): Promise<string>;
}
