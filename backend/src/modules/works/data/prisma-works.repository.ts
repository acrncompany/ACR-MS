import { Injectable } from '@nestjs/common';
import { issueCode, peekNextCode } from '../../../core/codes/code-sequence.js';
import { mapIntegrityError } from '../../../core/database/db-errors.js';
import { PrismaService } from '../../../core/database/prisma.service.js';
import { RecordAuditUseCase } from '../../audit/domain/record-audit.use-case.js';
import {
  WorkAuditSpec,
  WorkPage,
  WorkQuery,
  WorkRecord,
} from '../domain/work.records.js';
import { WorksRepository } from '../domain/works.repository.js';

const SELECT = { id: true, code: true, label: true } as const;

const toRecord = (row: { id: string; code: string; label: string }): WorkRecord => ({
  id: row.id,
  code: row.code,
  name: row.label,
});

@Injectable()
export class PrismaWorksRepository extends WorksRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: RecordAuditUseCase,
  ) {
    super();
  }

  async list(query: WorkQuery): Promise<WorkPage> {
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
      this.prisma.client.complianceLaw.count({ where }),
      this.prisma.client.complianceLaw.findMany({
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
    return this.prisma.tx((tx) => peekNextCode(tx, 'work'));
  }

  async create(
    name: string,
    key: string,
    audit: WorkAuditSpec,
  ): Promise<WorkRecord> {
    try {
      return await this.prisma.tx(async (tx) => {
        // The code is issued INSIDE this transaction: one atomic increment, never count + 1.
        const code = await issueCode(tx, 'work');
        const created = await tx.complianceLaw.create({
          data: { code, key, label: name, createdBy: audit.userId } as never,
          select: SELECT,
        });
        await this.audit.executeIn(tx, {
          ...audit,
          entity: 'work',
          entityId: created.id,
          changes: { code, ...audit.changes },
        });
        return toRecord(created);
      });
    } catch (error) {
      return mapIntegrityError(error, {
        unique: 'A work with this name already exists',
        reference: 'Unknown reference',
      });
    }
  }

  async rename(
    id: string,
    name: string,
    audit: WorkAuditSpec,
  ): Promise<WorkRecord | null> {
    try {
      return await this.prisma.tx(async (tx) => {
        const current = await tx.complianceLaw.findFirst({
          where: { id, deletedAt: null },
          select: SELECT,
        });
        if (!current) return null;
        const updated = await tx.complianceLaw.update({
          where: { id },
          data: { label: name },
          select: SELECT,
        });
        await this.audit.executeIn(tx, {
          ...audit,
          entity: 'work',
          entityId: id,
          changes: { code: current.code, name: { from: current.label, to: name } },
        });
        return toRecord(updated);
      });
    } catch (error) {
      return mapIntegrityError(error, {
        unique: 'A work with this name already exists',
        reference: 'Unknown reference',
      });
    }
  }
}
