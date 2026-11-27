import { AuthIdentity } from './auth.types.js';

export abstract class TokenIssuer {
  abstract issue(identity: AuthIdentity): Promise<string>;
  /** Returns the identity inside a valid, unexpired token, or null for anything else. */
  abstract verify(token: string): Promise<AuthIdentity | null>;
}
