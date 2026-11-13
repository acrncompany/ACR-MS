import { Module } from '@nestjs/common';
import { PrismaUserRepository } from './data/prisma-user.repository.js';
import { FindUserByEmailUseCase } from './domain/find-user-by-email.use-case.js';
import { UserRepository } from './domain/user.repository.js';

@Module({
  providers: [{ provide: UserRepository, useClass: PrismaUserRepository }, FindUserByEmailUseCase],
  exports: [FindUserByEmailUseCase],
})
export class UserModule {}
