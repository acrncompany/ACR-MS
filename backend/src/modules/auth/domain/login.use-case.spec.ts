import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../../core/config/app-config.js';
import { UnauthorizedError } from '../../../core/errors/app-error.js';
import type { RecordAuditUseCase } from '../../audit/domain/record-audit.use-case.js';
import type { GetSessionPolicyUseCase } from '../../tenant/domain/get-tenant.use-cases.js';
import type { FindUserByEmailUseCase } from '../../user/domain/find-user-by-email.use-case.js';
import type {
  RecordLoginFailureUseCase,
  RecordLoginSuccessUseCase,
} from '../../user/domain/login-state.use-cases.js';
import type { UserEntity } from '../../user/domain/user.entity.js';
import { LoginUseCase } from './login.use-case.js';
import type { PasswordHasher } from './password-hasher.js';
import type { RefreshTokens } from './refresh-tokens.js';
import type { SessionRepository } from './session.repository.js';
import type { TokenIssuer } from './token-issuer.js';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const client = { ip: '127.0.0.1', userAgent: 'test' };

const user: UserEntity = {
  id: 'u1',
  tenantId: 't1',
  email: 'a@b.com',
  name: 'Alice',
  employeeCode: 'EMP-0001',
  passwordHash: 'stored-hash',
  mustChangePassword: false,
  status: 'ACTIVE',
  positionId: null,
  failedLoginCount: 0,
  lockedUntil: null,
};

function setup(found: UserEntity | null) {
  const findUser = { execute: vi.fn().mockResolvedValue(found) };
  const recordFailure = {
    execute: vi
      .fn()
      .mockResolvedValue({ failedLoginCount: 1, lockedNow: false, lockedUntil: null }),
  };
  const recordSuccess = { execute: vi.fn().mockResolvedValue(undefined) };
  const policy = {
    execute: vi
      .fn()
      .mockResolvedValue({ refreshTokenDays: 7, sessionMaxDays: 30, idleTimeoutMinutes: null }),
  };
  const hasher = {
    hash: vi.fn().mockResolvedValue('decoy-hash'),
    verify: vi.fn(
      async (plain: string, hash: string) => plain === 'right' && hash === 'stored-hash',
    ),
  };
  const tokens = { issue: vi.fn().mockResolvedValue('jwt') };
  const refreshTokens = { generate: vi.fn().mockReturnValue({ token: 'rt', hash: 'rth' }) };
  const sessions = { create: vi.fn().mockResolvedValue({ id: 's1' }) };
  const audit = { execute: vi.fn().mockResolvedValue(undefined) };
  const config = {
    get: (key: string) => ({ LOGIN_MAX_FAILURES: 5, LOGIN_LOCK_MINUTES: 15 })[key],
    jwtExpiresInSeconds: 900,
  };
  const useCase = new LoginUseCase(
    findUser as unknown as FindUserByEmailUseCase,
    recordFailure as unknown as RecordLoginFailureUseCase,
    recordSuccess as unknown as RecordLoginSuccessUseCase,
    policy as unknown as GetSessionPolicyUseCase,
    hasher as unknown as PasswordHasher,
    tokens as unknown as TokenIssuer,
    refreshTokens as unknown as RefreshTokens,
    sessions as unknown as SessionRepository,
    audit as unknown as RecordAuditUseCase,
    config as unknown as AppConfig,
  );
  return { useCase, hasher, tokens, sessions, audit, recordFailure, recordSuccess };
}

const failure = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (e: unknown) => e,
  );

const login = (useCase: LoginUseCase, email: string, password: string) =>
  useCase.execute({ email, password, client });

describe('LoginUseCase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('creates a session and issues an access token bound to it on success', async () => {
    const { useCase, tokens, sessions, recordSuccess, audit } = setup(user);
    const result = await login(useCase, 'A@B.com ', 'right');

    expect(result.accessToken).toBe('jwt');
    expect(result.refreshToken).toBe('rt');
    expect(tokens.issue).toHaveBeenCalledWith({ userId: 'u1', tenantId: 't1', sessionId: 's1' });
    expect(sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', refreshTokenHash: 'rth' }),
    );
    expect(recordSuccess.execute).toHaveBeenCalledWith('u1', NOW);
    expect(audit.execute).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login.success', userId: 'u1' }),
    );
  });

  it('caps the refresh window at the absolute session limit', async () => {
    const { useCase, sessions } = setup(user);
    await login(useCase, 'a@b.com', 'right');
    const created = sessions.create.mock.calls[0][0] as {
      expiresAt: Date;
      absoluteExpiresAt: Date;
    };
    expect(created.expiresAt.getTime() - NOW.getTime()).toBe(7 * 86_400_000);
    expect(created.absoluteExpiresAt.getTime() - NOW.getTime()).toBe(30 * 86_400_000);
  });

  it('returns the identical error for a wrong password and an unknown email', async () => {
    const wrong = await failure(login(setup(user).useCase, 'a@b.com', 'wrong'));
    const unknown = await failure(login(setup(null).useCase, 'nobody@b.com', 'right'));

    expect(wrong).toBeInstanceOf(UnauthorizedError);
    expect(unknown).toBeInstanceOf(UnauthorizedError);
    expect((wrong as Error).message).toBe('Invalid credentials');
    expect((unknown as Error).message).toBe((wrong as Error).message);
  });

  it('still runs a password verification when the email is unknown', async () => {
    const { useCase, hasher } = setup(null);
    await failure(login(useCase, 'nobody@b.com', 'right'));
    expect(hasher.verify).toHaveBeenCalledTimes(1);
  });

  it('counts a wrong password and audits the failure', async () => {
    const { useCase, recordFailure, audit } = setup(user);
    await failure(login(useCase, 'a@b.com', 'wrong'));
    expect(recordFailure.execute).toHaveBeenCalledWith(
      'u1',
      NOW,
      5,
      new Date(NOW.getTime() + 15 * 60_000),
    );
    expect(audit.execute).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login.failure', userId: 'u1' }),
    );
  });

  it('audits a lockout when the failure that locks the account happens', async () => {
    const { useCase, recordFailure, audit } = setup(user);
    recordFailure.execute.mockResolvedValue({
      failedLoginCount: 5,
      lockedNow: true,
      lockedUntil: new Date(NOW.getTime() + 900_000),
    });
    await failure(login(useCase, 'a@b.com', 'wrong'));
    expect(audit.execute).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login.lockout' }),
    );
  });

  it('rejects a locked account even with the right password, without counting it', async () => {
    const locked = { ...user, lockedUntil: new Date(NOW.getTime() + 60_000) };
    const { useCase, sessions, recordFailure } = setup(locked);
    const error = await failure(login(useCase, 'a@b.com', 'right'));
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as Error).message).toBe('Invalid credentials');
    expect(sessions.create).not.toHaveBeenCalled();
    expect(recordFailure.execute).not.toHaveBeenCalled();
  });

  it('accepts the right password once the lock has expired', async () => {
    const expired = { ...user, failedLoginCount: 5, lockedUntil: new Date(NOW.getTime() - 1) };
    const { useCase } = setup(expired);
    await expect(login(useCase, 'a@b.com', 'right')).resolves.toMatchObject({ accessToken: 'jwt' });
  });

  it('rejects disabled users with the same generic error', async () => {
    const { useCase, sessions } = setup({ ...user, status: 'DISABLED' });
    const error = await failure(login(useCase, 'a@b.com', 'right'));
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as Error).message).toBe('Invalid credentials');
    expect(sessions.create).not.toHaveBeenCalled();
  });
});
