import { describe, expect, it } from 'vitest';
import { passwordProblems } from './password-policy.js';
import { generateTemporaryPassword } from './temporary-password.js';

describe('password policy', () => {
  it('accepts a strong password', () => {
    expect(passwordProblems('Tr0ub4dor&Cherry-Pickle')).toEqual([]);
  });

  it('rejects short, single-class and missing-class passwords', () => {
    expect(passwordProblems('Abc1!')).toContain('use at least 12 characters');
    expect(passwordProblems('alllowercaseletters')).toEqual(
      expect.arrayContaining(['add an upper-case letter', 'add a digit', 'add a symbol']),
    );
    expect(passwordProblems('NoSymbolsHere123')).toContain('add a symbol');
  });

  it('rejects common passwords, also when padded', () => {
    expect(passwordProblems('Password123!')).toContain('it is too common');
    expect(passwordProblems('Xx-Welcome123-Xx')).toContain('it is too common');
  });

  it('rejects a password containing the email or name', () => {
    expect(passwordProblems('Priya.nair#2026!', { email: 'priya.nair@acr.test' })).toContain(
      'it must not contain your email',
    );
    expect(passwordProblems('Meera-Pillai-2026!', { name: 'Meera Pillai' })).toContain(
      'it must not contain your name',
    );
  });

  it('generates temporary passwords that satisfy the policy', () => {
    for (let i = 0; i < 200; i++) {
      const password = generateTemporaryPassword();
      expect(password).toHaveLength(16);
      expect(passwordProblems(password)).toEqual([]);
    }
    expect(generateTemporaryPassword()).not.toBe(generateTemporaryPassword());
  });
});
