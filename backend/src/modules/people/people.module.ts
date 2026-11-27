import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { PrismaPeopleRepository } from './data/prisma-people.repository.js';
import { PeopleRepository } from './domain/people.repository.js';
import {
  CreateHrDepartmentUseCase,
  CreateHrDesignationUseCase,
  CreateHrEmployeeUseCase,
  ListHrDepartmentsUseCase,
  ListHrDesignationsUseCase,
  ListHrEmployeesUseCase,
  ListHrOptionsUseCase,
  PeekHrCodeUseCase,
} from './domain/people.use-cases.js';
import { PeopleController } from './presentation/people.controller.js';

@Module({
  imports: [AuditModule],
  controllers: [PeopleController],
  providers: [
    { provide: PeopleRepository, useClass: PrismaPeopleRepository },
    ListHrDepartmentsUseCase,
    ListHrDesignationsUseCase,
    ListHrEmployeesUseCase,
    ListHrOptionsUseCase,
    PeekHrCodeUseCase,
    CreateHrDepartmentUseCase,
    CreateHrDesignationUseCase,
    CreateHrEmployeeUseCase,
  ],
})
export class PeopleModule {}
