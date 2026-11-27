import { Injectable } from '@nestjs/common';
import { UnauthorizedError, ValidationError } from '../../../core/errors/app-error.js';
import { utcNow } from '../../../core/utils/clock.js';
import { RecordAuditUseCase } from '../../audit/domain/record-audit.use-case.js';
import { SetUserPasswordUseCase } from '../../user/domain/active-users.use-cases.js';
import { FindUserByIdUseCase } from '../../user/domain/find-user-by-id.use-case.js';
import { AUTH_REQUIRED, AuthIdentity, ClientContext } from './auth.types.js';
import { PasswordHasher } from './password-hasher.js';
import { assertStrongPassword } from './password-policy.js';
import { SessionRepository } from './session.repository.js';
import { generateTemporaryPassword } from './temporary-password.js';

export interface PreparedPassword {
  /** Clear text. Handed to the admin once when generated; never stored or logged. */
  plain: string;
  hash: string;
  generated: boolean;
}

/**
 * Turns "admin sets a password" or "generate one" into a policy-checked hash. Used when staff
 * are created. The clear text of a generated password is returned so it can be shown ONCE.
 */
@Injectable()
export class PrepareNewPasswordUseCase {
  constructor(private readonly hasher: PasswordHasher) {}

  async execute(input: {
    password?: string;
    generate?: boolean;
    email: string;
    name: string;
  }): Promise<PreparedPassword> {
    const generated = input.generate === true;
    if (generated === Boolean(input.password)) {
      throw new ValidationError('Provide either a password or generateTemporaryPassword, not both');
    }
    const plain = generated ? generateTemporaryPassword() : (input.password as string);
    assertStrongPassword(plain, { email: input.email, name: input.name });
    return { plain, hash: await this.hasher.hash(plain), generated };
  }
}

/** Revokes every live session of a user (deactivation, delete). Returns how many were revoked. */
@Injectable()
export class RevokeUserSessionsUseCase {
  constructor(private readonly sessions: SessionRepository) {}

  execute(userId: string, reason: string): Promise<number> {
    return this.sessions.revokeAllForUser(userId, reason, utcNow());
  }
}

/** Checks the CURRENT user's password (re-authentication for sensitive actions). */
@Injectable()
export class VerifyUserPasswordUseCase {
  constructor(
    private readonly findUser: FindUserByIdUseCase,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(userId: string, password: string): Promise<boolean> {
    const user = await this.findUser.execute(userId);
    if (!user) return false;
    return this.hasher.verify(password, user.passwordHash);
  }
}

/**
 * The user chooses their own password. Required after an admin set a temporary one. Wrong current
 * password is a 401; the new password must pass the policy and differ from the current one. All
 * OTHER sessions end, the current one stays.
 */
@Injectable()
export class ChangePasswordUseCase {
  constructor(
    private readonly findUser: FindUserByIdUseCase,
    private readonly hasher: PasswordHasher,
    private readonly setPassword: SetUserPasswordUseCase,
    private readonly sessions: SessionRepository,
    private readonly audit: RecordAuditUseCase,
  ) {}

  async execute(
    identity: AuthIdentity,
    input: { currentPassword: string; newPassword: string },
    client: ClientContext,
  ): Promise<void> {
    const user = await this.findUser.execute(identity.userId);
    if (!user) throw new UnauthorizedError(AUTH_REQUIRED);
    if (!(await this.hasher.verify(input.currentPassword, user.passwordHash))) {
      await this.audit.execute({
        action: 'auth.password.change.failure',
        entity: 'user',
        entityId: user.id,
        userId: user.id,
        changes: { reason: 'wrong_current_password' },
        ip: client.ip,
      });
      throw new UnauthorizedError('Current password is incorrect');
    }
    assertStrongPassword(input.newPassword, { email: user.email, name: user.name });
    if (await this.hasher.verify(input.newPassword, user.passwordHash)) {
      throw new ValidationError('The new password must differ from the current one');
    }
    await this.setPassword.execute(user.id, await this.hasher.hash(input.newPassword), false);
    const revoked = await this.sessions.revokeOthers(
      user.id,
      identity.sessionId,
      'password_changed',
      utcNow(),
    );
    await this.audit.execute({
      action: 'auth.password.change',
      entity: 'user',
      entityId: user.id,
      userId: user.id,
      changes: { revokedOtherSessions: revoked, wasTemporary: user.mustChangePassword },
      ip: client.ip,
    });
  }
}
