import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../core/config/app-config.js';
import { UnauthorizedError } from '../../../core/errors/app-error.js';
import { utcNow } from '../../../core/utils/clock.js';
import { RecordAuditUseCase } from '../../audit/domain/record-audit.use-case.js';
import { GetSessionPolicyUseCase } from '../../tenant/domain/get-tenant.use-cases.js';
import { FindUserByEmailUseCase } from '../../user/domain/find-user-by-email.use-case.js';
import {
  RecordLoginFailureUseCase,
  RecordLoginSuccessUseCase,
} from '../../user/domain/login-state.use-cases.js';
import { AuthResult, ClientContext } from './auth.types.js';
import { PasswordHasher } from './password-hasher.js';
import { RefreshTokens } from './refresh-tokens.js';
import { SessionRepository } from './session.repository.js';
import { TokenIssuer } from './token-issuer.js';

export interface LoginInput {
  email: string;
  password: string;
  client: ClientContext;
}

export interface LoginResult extends AuthResult {
  user: { id: string; name: string; email: string; mustChangePassword: boolean };
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/**
 * Runs inside a tenant context that the tenant module already resolved from the host, so the
 * user lookup is scoped to that tenant. Credentials never choose the tenant.
 *
 * Every failure (unknown email, wrong password, locked or disabled account) returns the same
 * "Invalid credentials" error. A password hash check always runs (against a decoy for unknown
 * emails), so response time does not reveal which emails exist or which accounts are locked.
 */
@Injectable()
export class LoginUseCase {
  private decoyHash?: Promise<string>;

  constructor(
    private readonly findUserByEmail: FindUserByEmailUseCase,
    private readonly recordFailure: RecordLoginFailureUseCase,
    private readonly recordSuccess: RecordLoginSuccessUseCase,
    private readonly getPolicy: GetSessionPolicyUseCase,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenIssuer,
    private readonly refreshTokens: RefreshTokens,
    private readonly sessions: SessionRepository,
    private readonly audit: RecordAuditUseCase,
    private readonly config: AppConfig,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.findUserByEmail.execute(email);
    const passwordMatches = await this.hasher.verify(
      input.password,
      user ? user.passwordHash : await this.getDecoyHash(),
    );
    const now = utcNow();

    if (!user) {
      await this.audit.execute({
        action: 'auth.login.failure',
        entity: 'user',
        changes: { reason: 'unknown_email', email: email.slice(0, 254) },
        ip: input.client.ip,
      });
      throw new UnauthorizedError();
    }

    if (user.lockedUntil && user.lockedUntil > now) {
      await this.failureAudit(user.id, 'locked', input);
      throw new UnauthorizedError();
    }

    if (!passwordMatches) {
      const lockUntil = new Date(now.getTime() + this.config.get('LOGIN_LOCK_MINUTES') * MINUTE_MS);
      const result = await this.recordFailure.execute(
        user.id,
        now,
        this.config.get('LOGIN_MAX_FAILURES'),
        lockUntil,
      );
      await this.failureAudit(user.id, 'wrong_password', input, {
        failedLoginCount: result.failedLoginCount,
      });
      if (result.lockedNow) {
        await this.audit.execute({
          action: 'auth.login.lockout',
          entity: 'user',
          entityId: user.id,
          userId: user.id,
          changes: { lockedUntil: result.lockedUntil?.toISOString() ?? null },
          ip: input.client.ip,
        });
      }
      throw new UnauthorizedError();
    }

    if (user.status !== 'ACTIVE') {
      await this.failureAudit(user.id, 'user_disabled', input);
      throw new UnauthorizedError();
    }

    const policy = await this.getPolicy.execute();
    const absoluteExpiresAt = new Date(now.getTime() + policy.sessionMaxDays * DAY_MS);
    const expiresAt = new Date(
      Math.min(now.getTime() + policy.refreshTokenDays * DAY_MS, absoluteExpiresAt.getTime()),
    );
    const refresh = this.refreshTokens.generate();
    const session = await this.sessions.create({
      userId: user.id,
      refreshTokenHash: refresh.hash,
      userAgent: input.client.userAgent,
      ip: input.client.ip,
      expiresAt,
      absoluteExpiresAt,
      lastUsedAt: now,
    });
    await this.recordSuccess.execute(user.id, now);

    const accessToken = await this.tokens.issue({
      userId: user.id,
      tenantId: user.tenantId,
      sessionId: session.id,
    });
    await this.audit.execute({
      action: 'auth.login.success',
      entity: 'session',
      entityId: session.id,
      userId: user.id,
      ip: input.client.ip,
    });

    return {
      accessToken,
      expiresIn: this.config.jwtExpiresInSeconds,
      refreshToken: refresh.token,
      refreshExpiresAt: expiresAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  private failureAudit(
    userId: string,
    reason: string,
    input: LoginInput,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    return this.audit.execute({
      action: 'auth.login.failure',
      entity: 'user',
      entityId: userId,
      userId,
      changes: { reason, ...extra },
      ip: input.client.ip,
    });
  }

  /** A hash of a random value, computed once, used only to equalise timing. */
  private getDecoyHash(): Promise<string> {
    this.decoyHash ??= this.hasher.hash(`decoy-${Math.random()}-${Date.now()}`);
    return this.decoyHash;
  }
}
