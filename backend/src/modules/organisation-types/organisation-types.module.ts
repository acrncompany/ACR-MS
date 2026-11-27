import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { PrismaOrganisationTypesRepository } from './data/prisma-organisation-types.repository.js';
import { OrganisationTypesRepository } from './domain/organisation-types.repository.js';
import {
  CreateOrganisationTypeUseCase,
  ListOrganisationTypesUseCase,
  PeekOrganisationTypeCodeUseCase,
  UpdateOrganisationTypeUseCase,
} from './domain/organisation-types.use-cases.js';
import { OrganisationTypesController } from './presentation/organisation-types.controller.js';

@Module({
  imports: [AuditModule],
  controllers: [OrganisationTypesController],
  providers: [
    { provide: OrganisationTypesRepository, useClass: PrismaOrganisationTypesRepository },
    ListOrganisationTypesUseCase,
    CreateOrganisationTypeUseCase,
    PeekOrganisationTypeCodeUseCase,
    UpdateOrganisationTypeUseCase,
  ],
})
export class OrganisationTypesModule {}
