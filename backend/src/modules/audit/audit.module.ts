import { Module } from '@nestjs/common';
import { PrismaAuditRepository } from './data/prisma-audit.repository.js';
import { AuditRepository } from './domain/audit.repository.js';
import {
  CountAuditEntriesByUserUseCase,
  ListActorAuditUseCase,
  ListEntityAuditUseCase,
  RecordAuditUseCase,
} from './domain/record-audit.use-case.js';

@Module({
  providers: [
    { provide: AuditRepository, useClass: PrismaAuditRepository },
    RecordAuditUseCase,
    ListEntityAuditUseCase,
    ListActorAuditUseCase,
    CountAuditEntriesByUserUseCase,
  ],
  exports: [
    RecordAuditUseCase,
    ListEntityAuditUseCase,
    ListActorAuditUseCase,
    CountAuditEntriesByUserUseCase,
  ],
})
export class AuditModule {}
