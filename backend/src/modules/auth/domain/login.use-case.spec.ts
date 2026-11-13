import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from '../../../core/errors/app-error.js';
import { FindUserByEmailUseCase } from '../../user/domain/find-user-by-email.use-case.js';
import { UserEntity } from '../../user/domain/user.entity.js';
import { LoginUseCase } from './login.use-case.js';
import { PasswordHasher } from './password-hasher.js';
import { TokenIssuer } from './token-issuer.js';

const user: UserEntity = {
  id: 'u1',
  tenantId: 't1',
  email: 'a@b.com',
  name: 'Alice',
  passwordHash: 'stored-hash',
  status: 'ACTIVE',
};

function setup(found: UserEntity | null) {
  const find = { execute: vi.fn().mockResolvedValue(found) } as unknown as FindUserByEmailUseCase;
  const hasher = {
    hash: vi.fn().mockResolvedValue('decoy-hash'),
    verify: vi.fn(
      async (plain: string, hash: string) => plain === 'right' && hash === 'stored-hash',
    ),
  } as unknown as PasswordHasher;
  const tokens = { issue: vi.fn().mockResolvedValue('jwt') } as unknown as TokenIssuer;
  return { useCase: new LoginUseCase(find, hasher, tokens), hasher, tokens };
}

const failure = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (e: unknown) => e,
  );

describe('LoginUseCase', () => {
  it('issues a token with user and tenant claims on success', async () => {
    const { useCase, tokens } = setup(user);
    const result = await useCase.execute('a@b.com', 'right');
    expect(result.accessToken).toBe('jwt');
    expect(tokens.issue).toHaveBeenCalledWith({ userId: 'u1', tenantId: 't1' });
  });

  it('returns the identical error for a wrong password and an unknown email', async () => {
    const wrongPassword = await failure(setup(user).useCase.execute('a@b.com', 'wrong'));
    const unknownEmail = await failure(setup(null).useCase.execute('nobody@b.com', 'right'));

    expect(wrongPassword).toBeInstanceOf(UnauthorizedError);
    expect(unknownEmail).toBeInstanceOf(UnauthorizedError);
    expect((wrongPassword as Error).message).toBe('Invalid credentials');
    expect((unknownEmail as Error).message).toBe((wrongPassword as Error).message);
  });

  it('still runs a password verification when the email is unknown', async () => {
    const { useCase, hasher } = setup(null);
    await failure(useCase.execute('nobody@b.com', 'right'));
    expect(hasher.verify).toHaveBeenCalledTimes(1);
  });

  it('rejects disabled users with the same generic error', async () => {
    const { useCase, tokens } = setup({ ...user, status: 'DISABLED' });
    const error = await failure(useCase.execute('a@b.com', 'right'));
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(tokens.issue).not.toHaveBeenCalled();
  });
});
