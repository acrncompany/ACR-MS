import { AppError } from '../../../core/errors/app-error.js';
import { COMMON_PASSWORDS } from './common-passwords.js';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export class WeakPasswordError extends AppError {
  constructor(readonly problems: string[]) {
    super('WEAK_PASSWORD', `Password is not strong enough: ${problems.join('; ')}.`, 400);
  }
}

export interface PasswordSubject {
  email?: string;
  name?: string;
}

/** Everything wrong with `password`; empty when it is acceptable. Enforced on the server. */
export function passwordProblems(password: string, subject: PasswordSubject = {}): string[] {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    problems.push(`use at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    problems.push(`use at most ${PASSWORD_MAX_LENGTH} characters`);
  }
  if (!/[a-z]/.test(password)) problems.push('add a lower-case letter');
  if (!/[A-Z]/.test(password)) problems.push('add an upper-case letter');
  if (!/[0-9]/.test(password)) problems.push('add a digit');
  if (!/[^A-Za-z0-9]/.test(password)) problems.push('add a symbol');

  const lower = password.toLowerCase();
  if (
    COMMON_PASSWORDS.some((word) => lower === word || (word.length >= 6 && lower.includes(word)))
  ) {
    problems.push('it is too common');
  }
  const email = subject.email?.trim().toLowerCase();
  if (email) {
    const local = email.split('@')[0] ?? '';
    if (lower === email || (local.length >= 4 && lower.includes(local))) {
      problems.push('it must not contain your email');
    }
  }
  for (const part of (subject.name ?? '').toLowerCase().split(/\s+/)) {
    if (part.length >= 4 && lower.includes(part)) {
      problems.push('it must not contain your name');
      break;
    }
  }
  return problems;
}

/** Throws a 400 `WEAK_PASSWORD` listing every problem. */
export function assertStrongPassword(password: string, subject: PasswordSubject = {}): void {
  const problems = passwordProblems(password, subject);
  if (problems.length) throw new WeakPasswordError(problems);
}
