import { ActiveUser, LoginFailureResult, UserEntity } from './user.entity.js';

export abstract class UserRepository {
  /** Looks up a non-deleted user by email within the current tenant. */
  abstract findByEmail(email: string): Promise<UserEntity | null>;
  abstract findById(id: string): Promise<UserEntity | null>;
  /**
   * Counts one failed attempt atomically. An expired lock starts a fresh count. Reaching
   * `maxFailures` locks the account until `lockUntil`.
   */
  abstract recordLoginFailure(
    userId: string,
    now: Date,
    maxFailures: number,
    lockUntil: Date,
  ): Promise<LoginFailureResult>;
  /** Sets a new password hash and the must-change flag (temporary password = true). */
  abstract setPassword(userId: string, passwordHash: string, mustChange: boolean): Promise<void>;
  /** Active, non-deleted staff, for dropdowns (names and codes only). */
  abstract listActive(): Promise<ActiveUser[]>;
  /** Which of `ids` are active, non-deleted users of this tenant. */
  abstract findActiveIds(ids: string[]): Promise<string[]>;
  /** Clears the failure counter and lock, and stamps lastLoginAt. */
  abstract recordLoginSuccess(userId: string, now: Date): Promise<void>;
}
