import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { PrismaOrganizationRepository } from './data/prisma-organization.repository.js';
import { GetUserOrgContextUseCase } from './domain/get-user-org-context.use-case.js';
import { OrganizationRepository } from './domain/organization.repository.js';
import {
  CreateDepartmentUseCase,
  CreatePositionUseCase,
  FindPositionUseCase,
  ListDepartmentsUseCase,
  ListPositionsUseCase,
  UpdateDepartmentUseCase,
  UpdatePositionUseCase,
} from './domain/organization.use-cases.js';
import { OrganizationController } from './presentation/organization.controller.js';

@Module({
  imports: [AuditModule],
  controllers: [OrganizationController],
  providers: [
    { provide: OrganizationRepository, useClass: PrismaOrganizationRepository },
    GetUserOrgContextUseCase,
    ListDepartmentsUseCase,
    ListPositionsUseCase,
    FindPositionUseCase,
    CreateDepartmentUseCase,
    UpdateDepartmentUseCase,
    CreatePositionUseCase,
    UpdatePositionUseCase,
  ],
  exports: [GetUserOrgContextUseCase, ListPositionsUseCase, FindPositionUseCase],
})
export class OrganizationModule {}
