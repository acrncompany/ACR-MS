import { Injectable } from '@nestjs/common';
import { UserEntity } from './user.entity.js';
import { UserRepository } from './user.repository.js';

/** Public entry point other modules (e.g. auth) use instead of touching user tables. */
@Injectable()
export class FindUserByEmailUseCase {
  constructor(private readonly users: UserRepository) {}

  execute(email: string): Promise<UserEntity | null> {
    return this.users.findByEmail(email.trim().toLowerCase());
  }
}
