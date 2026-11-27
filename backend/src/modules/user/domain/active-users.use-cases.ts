import { Injectable } from '@nestjs/common';
import { ActiveUser } from './user.entity.js';
import { UserRepository } from './user.repository.js';

@Injectable()
export class ListActiveUsersUseCase {
  constructor(private readonly users: UserRepository) {}

  execute(): Promise<ActiveUser[]> {
    return this.users.listActive();
  }
}

@Injectable()
export class FindActiveUserIdsUseCase {
  constructor(private readonly users: UserRepository) {}

  execute(ids: string[]): Promise<string[]> {
    return this.users.findActiveIds(ids);
  }
}

@Injectable()
export class SetUserPasswordUseCase {
  constructor(private readonly users: UserRepository) {}

  execute(userId: string, passwordHash: string, mustChange: boolean): Promise<void> {
    return this.users.setPassword(userId, passwordHash, mustChange);
  }
}
