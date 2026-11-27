import { Module } from '@nestjs/common';
import { CredentialCipher } from '../../core/crypto/credential-cipher.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaCredentialsRepository } from './data/prisma-credentials.repository.js';
import { CredentialsRepository } from './domain/credentials.repository.js';
import {
  ListCredentialFieldsUseCase,
  RevealCredentialUseCase,
  SetCredentialUseCase,
} from './domain/credentials.use-cases.js';

@Module({
  imports: [AuditModule, AuthModule],
  providers: [
    CredentialCipher,
    { provide: CredentialsRepository, useClass: PrismaCredentialsRepository },
    ListCredentialFieldsUseCase,
    SetCredentialUseCase,
    RevealCredentialUseCase,
  ],
  exports: [ListCredentialFieldsUseCase, SetCredentialUseCase, RevealCredentialUseCase],
})
export class CredentialsModule {}
