import { Injectable } from '@nestjs/common';
import { issueCode, peekNextCode } from '../../../core/codes/code-sequence.js';
import { mapIntegrityError } from '../../../core/database/db-errors.js';
import { PrismaService } from '../../../core/database/prisma.service.js';
import { RecordAuditUseCase } from '../../audit/domain/record-audit.use-case.js';
import {
  OrganisationTypeAuditSpec,
  OrganisationTypePage,
  OrganisationTypeQuery,
  OrganisationTypeRecord,
} from '../domain/organisation-type.records.js';
import { OrganisationTypesRepository } from '../domain/organisation-types.repository.js';

const SELECT = { id: true, code: true, label: true } as const;

const toRecord = (row: { id: string; code: string; label: string }): OrganisationTypeRecord => ({
  id: row.id,
  code: row.code,
  name: row.label,
});

@Injectable()
export class PrismaOrganisationTypesRepository extends OrganisationTypesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: RecordAuditUseCase,
  ) {
    super();
  }

  async list(query: OrganisationTypeQuery): Promise<OrganisationTypePage> {
    const where = {
      deletedAt: null,
      ...(query.q
        ? {
            OR: [
              { label: { contains: query.q, mode: 'insensitive' as const } },
              { code: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.client.organisationType.count({ where }),
      this.prisma.client.organisationType.findMany({
        where,
        select: SELECT,
        orderBy: [{ code: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toRecord), total, page: query.page, pageSize: query.pageSize };
  }

  peekNextCode(): Promise<string> {
    return this.prisma.tx((tx) => peekNextCode(tx, 'organisationType'));
  }

  async create(
    name: string,
    key: string,
    audit: OrganisationTypeAuditSpec,
  ): Promise<OrganisationTypeRecord> {
    try {
      return await this.prisma.tx(async (tx) => {
        // The code is issued INSIDE this transaction: one atomic increment, never count + 1.
        const code = await issueCode(tx, 'organisationType');
        const created = await tx.organisationType.create({
          data: { code, key, label: name, createdBy: audit.userId } as never,
          select: SELECT,
        });
        await this.audit.executeIn(tx, {
          ...audit,
          entity: 'organisation_type',
          entityId: created.id,
          changes: { code, ...audit.changes },
        });
        return toRecord(created);
      });
    } catch (error) {
      return mapIntegrityError(error, {
        unique: 'An organisation type with this name already exists',
        reference: 'Unknown reference',
      });
    }
  }

  async rename(
    id: string,
    name: string,
    audit: OrganisationTypeAuditSpec,
  ): Promise<OrganisationTypeRecord | null> {
    try {
      return await this.prisma.tx(async (tx) => {
        const current = await tx.organisationType.findFirst({
          where: { id, deletedAt: null },
          select: SELECT,
        });
        if (!current) return null;
        const updated = await tx.organisationType.update({
          where: { id },
          data: { label: name },
          select: SELECT,
        });
        await this.audit.executeIn(tx, {
          ...audit,
          entity: 'organisation_type',
          entityId: id,
          changes: { code: current.code, name: { from: current.label, to: name } },
        });
        return toRecord(updated);
      });
    } catch (error) {
      return mapIntegrityError(error, {
        unique: 'An organisation type with this name already exists',
        reference: 'Unknown reference',
      });
    }
  }
}
