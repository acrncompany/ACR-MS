import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service.js';
import { CredentialCipher } from '../../../core/crypto/credential-cipher.js';
import { RecordAuditUseCase } from '../../audit/domain/record-audit.use-case.js';
import type { CredentialField } from '../domain/credential-fields.js';
import { CredentialAuditSpec, CredentialsRepository } from '../domain/credentials.repository.js';

type CredentialCreateData = Parameters<
  PrismaService['client']['clientCredential']['create']
>[0]['data'];

@Injectable()
export class PrismaCredentialsRepository extends CredentialsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: CredentialCipher,
    private readonly audit: RecordAuditUseCase,
  ) {
    super();
  }

  async listFields(clientId: string): Promise<CredentialField[]> {
    const rows = await this.prisma.client.clientCredential.findMany({
      where: { clientId },
      select: { field: true },
      orderBy: { field: 'asc' },
    });
    return rows.map((r) => r.field as CredentialField);
  }

  async upsert(
    clientId: string,
    field: CredentialField,
    value: string,
    actorId: string,
    audit: CredentialAuditSpec,
  ): Promise<void> {
    await this.prisma.tx(async (tx) => {
      const tenantId = await this.tenantIdOf(tx, clientId);
      const raw = this.cipher.encrypt({ tenantId, clientId, field }, value);
      // Prisma's Bytes type wants a plain Uint8Array.
      const encrypted = {
        ciphertext: new Uint8Array(raw.ciphertext),
        iv: new Uint8Array(raw.iv),
        authTag: new Uint8Array(raw.authTag),
        keyId: raw.keyId,
      };
      const existing = await tx.clientCredential.findFirst({
        where: { clientId, field },
        select: { id: true },
      });
      if (existing) {
        await tx.clientCredential.update({
          where: { id: existing.id },
          data: { ...encrypted, updatedBy: actorId },
        });
      } else {
        await tx.clientCredential.create({
          data: {
            clientId,
            field,
            ...encrypted,
            createdBy: actorId,
            updatedBy: actorId,
          } as unknown as CredentialCreateData,
        });
      }
      await this.audit.executeIn(tx, { ...audit, entity: 'client', entityId: clientId });
    });
  }

  remove(clientId: string, field: CredentialField, audit: CredentialAuditSpec): Promise<boolean> {
    return this.prisma.tx(async (tx) => {
      const result = await tx.clientCredential.deleteMany({ where: { clientId, field } });
      if (result.count > 0) {
        await this.audit.executeIn(tx, { ...audit, entity: 'client', entityId: clientId });
      }
      return result.count > 0;
    });
  }

  revealAudited(
    clientId: string,
    field: CredentialField,
    audit: CredentialAuditSpec,
  ): Promise<string | null> {
    return this.prisma.tx(async (tx) => {
      const row = await tx.clientCredential.findFirst({
        where: { clientId, field },
        select: { ciphertext: true, iv: true, authTag: true, keyId: true },
      });
      if (!row) return null;
      const tenantId = await this.tenantIdOf(tx, clientId);
      const value = this.cipher.decrypt(
        { tenantId, clientId, field },
        {
          ciphertext: Buffer.from(row.ciphertext),
          iv: Buffer.from(row.iv),
          authTag: Buffer.from(row.authTag),
          keyId: row.keyId,
        },
      );
      await this.audit.executeIn(tx, { ...audit, entity: 'client', entityId: clientId });
      return value;
    });
  }

  /** The tenant the client belongs to (also what the encryption key is derived for). */
  private async tenantIdOf(
    tx: Parameters<Parameters<PrismaService['tx']>[0]>[0],
    clientId: string,
  ): Promise<string> {
    const client = await tx.client.findFirstOrThrow({
      where: { id: clientId },
      select: { tenantId: true },
    });
    return client.tenantId;
  }
}
