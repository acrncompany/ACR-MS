import { Module } from '@nestjs/common';
import { PrismaUserRepository } from './data/prisma-user.repository.js';
import {
  FindActiveUserIdsUseCase,
  ListActiveUsersUseCase,
  SetUserPasswordUseCase,
} from './domain/active-users.use-cases.js';
import { FindUserByEmailUseCase } from './domain/find-user-by-email.use-case.js';
import { FindUserByIdUseCase } from './domain/find-user-by-id.use-case.js';
import {
  RecordLoginFailureUseCase,
  RecordLoginSuccessUseCase,
} from './domain/login-state.use-cases.js';
import { UserRepository } from './domain/user.repository.js';

@Module({
  providers: [
    { provide: UserRepository, useClass: PrismaUserRepository },
    FindUserByEmailUseCase,
    FindUserByIdUseCase,
    RecordLoginFailureUseCase,
    RecordLoginSuccessUseCase,
    ListActiveUsersUseCase,
    FindActiveUserIdsUseCase,
    SetUserPasswordUseCase,
  ],
  exports: [
    FindUserByEmailUseCase,
    FindUserByIdUseCase,
    RecordLoginFailureUseCase,
    RecordLoginSuccessUseCase,
    ListActiveUsersUseCase,
    FindActiveUserIdsUseCase,
    SetUserPasswordUseCase,
  ],
})
export class UserModule {}
