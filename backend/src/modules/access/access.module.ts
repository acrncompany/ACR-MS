import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module.js';
import { UserModule } from '../user/user.module.js';
import { PrismaAccessRepository } from './data/prisma-access.repository.js';
import { AccessRepository } from './domain/access.repository.js';
import { GetUserAccessUseCase } from './domain/get-user-access.use-case.js';
import { ListRolesUseCase } from './domain/list-roles.use-case.js';
import { ResolveActorUseCase } from './domain/resolve-actor.use-case.js';
import { RolesController } from './presentation/roles.controller.js';

@Module({
  imports: [UserModule, OrganizationModule],
  controllers: [RolesController],
  providers: [
    { provide: AccessRepository, useClass: PrismaAccessRepository },
    GetUserAccessUseCase,
    ListRolesUseCase,
    ResolveActorUseCase,
  ],
  exports: [GetUserAccessUseCase, ResolveActorUseCase],
})
export class AccessModule {}
