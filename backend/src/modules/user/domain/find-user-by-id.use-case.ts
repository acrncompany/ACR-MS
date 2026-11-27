import { Injectable } from '@nestjs/common';
import { UserEntity } from './user.entity.js';
import { UserRepository } from './user.repository.js';

@Injectable()
export class FindUserByIdUseCase {
  constructor(private readonly users: UserRepository) {}

  execute(id: string): Promise<UserEntity | null> {
    return this.users.findById(id);
  }
}
