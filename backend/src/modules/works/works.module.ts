import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { PrismaWorksRepository } from './data/prisma-works.repository.js';
import { WorksRepository } from './domain/works.repository.js';
import {
  CreateWorkUseCase,
  ListWorksUseCase,
  PeekWorkCodeUseCase,
  UpdateWorkUseCase,
} from './domain/works.use-cases.js';
import { WorksController } from './presentation/works.controller.js';

@Module({
  imports: [AuditModule],
  controllers: [WorksController],
  providers: [
    { provide: WorksRepository, useClass: PrismaWorksRepository },
    ListWorksUseCase,
    CreateWorkUseCase,
    PeekWorkCodeUseCase,
    UpdateWorkUseCase,
  ],
})
export class WorksModule {}
