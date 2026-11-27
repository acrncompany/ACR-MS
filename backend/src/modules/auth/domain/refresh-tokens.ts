export abstract class RefreshTokens {
  /** A new random opaque token and its hash (the only form that is stored). */
  abstract generate(): { token: string; hash: string };
  abstract hash(token: string): string;
}
