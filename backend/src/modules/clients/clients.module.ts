import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { CredentialsModule } from '../credentials/credentials.module.js';
import { UserModule } from '../user/user.module.js';
import { PrismaClientsRepository } from './data/prisma-clients.repository.js';
import { ClientsRepository } from './domain/clients.repository.js';
import {
  CountUserClientFootprintUseCase,
  CreateClientUseCase,
  GetClientReferenceDataUseCase,
  GetClientUseCase,
  ListClientsUseCase,
  ListTeamOptionsUseCase,
  PeekClientCodeUseCase,
  SetClientActiveUseCase,
  UpdateClientUseCase,
} from './domain/clients.use-cases.js';
import { ClientsController } from './presentation/clients.controller.js';

@Module({
  imports: [AuditModule, CredentialsModule, UserModule],
  controllers: [ClientsController],
  providers: [
    { provide: ClientsRepository, useClass: PrismaClientsRepository },
    ListClientsUseCase,
    GetClientUseCase,
    GetClientReferenceDataUseCase,
    ListTeamOptionsUseCase,
    PeekClientCodeUseCase,
    CreateClientUseCase,
    UpdateClientUseCase,
    SetClientActiveUseCase,
    CountUserClientFootprintUseCase,
  ],
  exports: [CountUserClientFootprintUseCase],
})
export class ClientsModule {}
