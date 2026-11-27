import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../../core/config/app-config.js';
import { UnauthorizedError } from '../../../core/errors/app-error.js';
import type { RecordAuditUseCase } from '../../audit/domain/record-audit.use-case.js';
import type { GetSessionPolicyUseCase } from '../../tenant/domain/get-tenant.use-cases.js';
import type { FindUserByIdUseCase } from '../../user/domain/find-user-by-id.use-case.js';
import type { UserEntity } from '../../user/domain/user.entity.js';
import type { RefreshTokens } from './refresh-tokens.js';
import { RefreshUseCase } from './refresh.use-case.js';
import type { SessionEntity, SessionRepository } from './session.repository.js';
import type { TokenIssuer } from './token-issuer.js';

const NOW = new Date('2026-01-10T00:00:00.000Z');
const DAY = 86_400_000;
const client = { ip: '127.0.0.1', userAgent: 'test' };

const session: SessionEntity = {
  id: 's1',
  tenantId: 't1',
  userId: 'u1',
  expiresAt: new Date(NOW.getTime() + 2 * DAY),
  absoluteExpiresAt: new Date(NOW.getTime() + 10 * DAY),
  lastUsedAt: new Date(NOW.getTime() - 60_000),
  revokedAt: null,
  revokedReason: null,
  replacedById: null,
};

const activeUser = { id: 'u1', status: 'ACTIVE' } as UserEntity;

function setup(
  found: SessionEntity | null,
  options: { user?: UserEntity | null; idleMinutes?: number | null; rotated?: boolean } = {},
) {
  const sessions = {
    findByTokenHash: vi.fn().mockResolvedValue(found),
    rotate: vi.fn().mockResolvedValue(options.rotated === false ? null : { id: 's2' }),
    revoke: vi.fn().mockResolvedValue(undefined),
    revokeChain: vi.fn().mockResolvedValue(2),
  };
  const refreshTokens = {
    hash: vi.fn((t: string) => `hash-of-${t}`),
    generate: vi.fn().mockReturnValue({ token: 'new-rt', hash: 'new-hash' }),
  };
  const tokens = { issue: vi.fn().mockResolvedValue('new-jwt') };
  const findUser = {
    execute: vi.fn().mockResolvedValue(options.user === undefined ? activeUser : options.user),
  };
  const policy = {
    execute: vi.fn().mockResolvedValue({
      refreshTokenDays: 7,
      sessionMaxDays: 30,
      idleTimeoutMinutes: options.idleMinutes ?? null,
    }),
  };
  const audit = { execute: vi.fn().mockResolvedValue(undefined) };
  const config = { jwtExpiresInSeconds: 900 };
  const useCase = new RefreshUseCase(
    sessions as unknown as SessionRepository,
    refreshTokens as unknown as RefreshTokens,
    tokens as unknown as TokenIssuer,
    findUser as unknown as FindUserByIdUseCase,
    policy as unknown as GetSessionPolicyUseCase,
    audit as unknown as RecordAuditUseCase,
    config as unknown as AppConfig,
  );
  return { useCase, sessions, tokens, audit };
}

const failure = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (e: unknown) => e,
  );

describe('RefreshUseCase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('rotates: new refresh token and a new access token bound to the new session', async () => {
    const { useCase, sessions, tokens } = setup(session);
    const result = await useCase.execute('old-rt', client);

    expect(sessions.findByTokenHash).toHaveBeenCalledWith('hash-of-old-rt');
    expect(sessions.rotate).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ refreshTokenHash: 'new-hash', userId: 'u1' }),
      NOW,
    );
    expect(tokens.issue).toHaveBeenCalledWith({ userId: 'u1', tenantId: 't1', sessionId: 's2' });
    expect(result.refreshToken).toBe('new-rt');
    expect(result.accessToken).toBe('new-jwt');
  });

  it('slides the window by refreshTokenDays but never past the absolute limit', async () => {
    const near = { ...session, absoluteExpiresAt: new Date(NOW.getTime() + 3 * DAY) };
    const { useCase, sessions } = setup(near);
    const result = await useCase.execute('old-rt', client);
    expect(result.refreshExpiresAt).toEqual(near.absoluteExpiresAt);
    const next = sessions.rotate.mock.calls[0][1] as { absoluteExpiresAt: Date };
    expect(next.absoluteExpiresAt).toEqual(near.absoluteExpiresAt);

    const far = setup(session);
    const slid = await far.useCase.execute('old-rt', client);
    expect(slid.refreshExpiresAt.getTime() - NOW.getTime()).toBe(7 * DAY);
  });

  it('rejects a missing token and an unknown token', async () => {
    expect(await failure(setup(null).useCase.execute(undefined, client))).toBeInstanceOf(
      UnauthorizedError,
    );
    const { useCase, sessions } = setup(null);
    expect(await failure(useCase.execute('nope', client))).toBeInstanceOf(UnauthorizedError);
    expect(sessions.rotate).not.toHaveBeenCalled();
  });

  it('treats a replaced token as reuse: revokes the whole chain and audits it', async () => {
    const replaced = { ...session, revokedAt: NOW, replacedById: 's2' };
    const { useCase, sessions, audit } = setup(replaced);
    const error = await failure(useCase.execute('old-rt', client));

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(sessions.revokeChain).toHaveBeenCalledWith('s1', 'reuse_detected', NOW);
    expect(audit.execute).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.refresh.reuse', userId: 'u1', entityId: 's1' }),
    );
    expect(sessions.rotate).not.toHaveBeenCalled();
  });

  it('does not treat a token revoked by logout as reuse', async () => {
    const loggedOut = { ...session, revokedAt: NOW, revokedReason: 'logout' };
    const { useCase, sessions, audit } = setup(loggedOut);
    expect(await failure(useCase.execute('old-rt', client))).toBeInstanceOf(UnauthorizedError);
    expect(sessions.revokeChain).not.toHaveBeenCalled();
    expect(audit.execute).not.toHaveBeenCalled();
  });

  it('treats losing a parallel rotation as reuse', async () => {
    const { useCase, sessions, audit } = setup(session, { rotated: false });
    expect(await failure(useCase.execute('old-rt', client))).toBeInstanceOf(UnauthorizedError);
    expect(sessions.revokeChain).toHaveBeenCalled();
    expect(audit.execute).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.refresh.reuse' }),
    );
  });

  it('rejects a session past its sliding or absolute expiry', async () => {
    for (const expired of [
      { ...session, expiresAt: new Date(NOW.getTime() - 1) },
      { ...session, absoluteExpiresAt: new Date(NOW.getTime() - 1) },
    ]) {
      const { useCase, sessions } = setup(expired);
      expect(await failure(useCase.execute('old-rt', client))).toBeInstanceOf(UnauthorizedError);
      expect(sessions.revoke).toHaveBeenCalledWith('s1', 'expired', NOW);
      expect(sessions.rotate).not.toHaveBeenCalled();
    }
  });

  it('applies the idle timeout only when the tenant sets one', async () => {
    const idle = { ...session, lastUsedAt: new Date(NOW.getTime() - 31 * 60_000) };
    const limited = setup(idle, { idleMinutes: 30 });
    expect(await failure(limited.useCase.execute('old-rt', client))).toBeInstanceOf(
      UnauthorizedError,
    );
    expect(limited.sessions.revoke).toHaveBeenCalledWith('s1', 'idle_timeout', NOW);

    const unlimited = setup(idle, { idleMinutes: null });
    await expect(unlimited.useCase.execute('old-rt', client)).resolves.toBeDefined();
  });

  it('rejects a disabled or missing user', async () => {
    for (const user of [{ ...activeUser, status: 'DISABLED' } as UserEntity, null]) {
      const { useCase, sessions } = setup(session, { user });
      expect(await failure(useCase.execute('old-rt', client))).toBeInstanceOf(UnauthorizedError);
      expect(sessions.rotate).not.toHaveBeenCalled();
    }
  });
});
