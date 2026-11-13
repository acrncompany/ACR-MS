import { UserEntity } from './user.entity.js';

export abstract class UserRepository {
  /** Looks up a non-deleted user by email within the current tenant. */
  abstract findByEmail(email: string): Promise<UserEntity | null>;
}
