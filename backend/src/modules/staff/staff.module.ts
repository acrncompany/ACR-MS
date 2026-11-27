import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ClientsModule } from '../clients/clients.module.js';
import { OrganizationModule } from '../organization/organization.module.js';
import { UserModule } from '../user/user.module.js';
import { PrismaStaffRepository } from './data/prisma-staff.repository.js';
import { StaffRepository } from './domain/staff.repository.js';
import {
  CreateStaffUseCase,
  DeleteStaffUseCase,
  GetStaffUseCase,
  ListAssignableStaffUseCase,
  ListCreatablePositionsUseCase,
  ListStaffUseCase,
  PeekStaffCodeUseCase,
  SetStaffActiveUseCase,
  StaffScope,
  UpdateStaffUseCase,
} from './domain/staff.use-cases.js';
import { StaffController } from './presentation/staff.controller.js';

@Module({
  imports: [AuditModule, AuthModule, ClientsModule, OrganizationModule, UserModule],
  controllers: [StaffController],
  providers: [
    { provide: StaffRepository, useClass: PrismaStaffRepository },
    StaffScope,
    ListStaffUseCase,
    GetStaffUseCase,
    ListAssignableStaffUseCase,
    ListCreatablePositionsUseCase,
    CreateStaffUseCase,
    PeekStaffCodeUseCase,
    UpdateStaffUseCase,
    SetStaffActiveUseCase,
    DeleteStaffUseCase,
  ],
})
export class StaffModule {}
