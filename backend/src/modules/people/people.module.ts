import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { PrismaPeopleRepository } from './data/prisma-people.repository.js';
import { PeopleRepository } from './domain/people.repository.js';
import {
  CreateHrDepartmentUseCase,
  CreateHrDesignationUseCase,
  CreateHrPersonUseCase,
  DeleteHrPersonUseCase,
  GetHrAdditionalDocumentUseCase,
  GetHrDocumentUseCase,
  GetHrPersonUseCase,
  ListHrDepartmentsUseCase,
  ListHrDesignationsUseCase,
  ListHrOptionsUseCase,
  ListHrPeopleUseCase,
  PeekHrCodeUseCase,
  UpdateHrPersonUseCase,
  UploadHrAdditionalDocumentUseCase,
  UploadHrDocumentUseCase,
} from './domain/people.use-cases.js';
import { PeopleController } from './presentation/people.controller.js';

@Module({
  imports: [AuditModule],
  controllers: [PeopleController],
  providers: [
    { provide: PeopleRepository, useClass: PrismaPeopleRepository },
    ListHrDepartmentsUseCase,
    ListHrDesignationsUseCase,
    ListHrPeopleUseCase,
    GetHrPersonUseCase,
    ListHrOptionsUseCase,
    PeekHrCodeUseCase,
    CreateHrDepartmentUseCase,
    CreateHrDesignationUseCase,
    CreateHrPersonUseCase,
    UpdateHrPersonUseCase,
    DeleteHrPersonUseCase,
    UploadHrDocumentUseCase,
    GetHrDocumentUseCase,
    UploadHrAdditionalDocumentUseCase,
    GetHrAdditionalDocumentUseCase,
  ],
})
export class PeopleModule {}
