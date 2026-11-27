import { Injectable } from '@nestjs/common';
import { LoginFailureResult } from './user.entity.js';
import { UserRepository } from './user.repository.js';

@Injectable()
export class RecordLoginFailureUseCase {
  constructor(private readonly users: UserRepository) {}

  execute(
    userId: string,
    now: Date,
    maxFailures: number,
    lockUntil: Date,
  ): Promise<LoginFailureResult> {
    return this.users.recordLoginFailure(userId, now, maxFailures, lockUntil);
  }
}

@Injectable()
export class RecordLoginSuccessUseCase {
  constructor(private readonly users: UserRepository) {}

  execute(userId: string, now: Date): Promise<void> {
    return this.users.recordLoginSuccess(userId, now);
  }
}
