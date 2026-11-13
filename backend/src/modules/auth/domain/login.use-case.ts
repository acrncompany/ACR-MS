import { Injectable } from '@nestjs/common';
import { UnauthorizedError } from '../../../core/errors/app-error.js';
import { FindUserByEmailUseCase } from '../../user/domain/find-user-by-email.use-case.js';
import { PasswordHasher } from './password-hasher.js';
import { TokenIssuer } from './token-issuer.js';

export interface LoginResult {
  accessToken: string;
  user: { id: string; name: string; email: string };
}

/**
 * Runs inside a tenant context that the tenant module already resolved from the host, so the
 * user lookup below is scoped to that tenant. Credentials never choose the tenant.
 *
 * Every failure (unknown email, wrong password, disabled account) returns the same
 * "Invalid credentials" error, and unknown emails still pay for a password hash check so
 * response time does not reveal which emails exist.
 */
@Injectable()
export class LoginUseCase {
  private decoyHash?: Promise<string>;

  constructor(
    private readonly findUserByEmail: FindUserByEmailUseCase,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenIssuer,
  ) {}

  async execute(email: string, password: string): Promise<LoginResult> {
    const user = await this.findUserByEmail.execute(email);
    const hash = user ? user.passwordHash : await this.getDecoyHash();
    const passwordMatches = await this.hasher.verify(password, hash);

    if (!user || !passwordMatches || user.status !== 'ACTIVE') {
      throw new UnauthorizedError();
    }

    const accessToken = await this.tokens.issue({ userId: user.id, tenantId: user.tenantId });
    return { accessToken, user: { id: user.id, name: user.name, email: user.email } };
  }

  /** A hash of a random value, computed once, used only to equalise timing. */
  private getDecoyHash(): Promise<string> {
    this.decoyHash ??= this.hasher.hash(`decoy-${Math.random()}-${Date.now()}`);
    return this.decoyHash;
  }
}
