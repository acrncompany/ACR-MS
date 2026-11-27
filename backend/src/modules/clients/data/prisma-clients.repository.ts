import { Injectable } from '@nestjs/common';
import { issueCode, peekNextCode } from '../../../core/codes/code-sequence.js';
import { mapIntegrityError } from '../../../core/database/db-errors.js';
import { PrismaService, type TenantTransaction } from '../../../core/database/prisma.service.js';
import { ValidationError } from '../../../core/errors/app-error.js';
import { RecordAuditUseCase } from '../../audit/domain/record-audit.use-case.js';
import {
  ClientAuditSpec,
  ClientPage,
  ClientQuery,
  ClientRecord,
  ClientWrite,
  KycStatusValue,
  ReferenceData,
} from '../domain/client.records.js';
import { ClientsRepository } from '../domain/clients.repository.js';

const CLIENT_SELECT = {
  id: true,
  clientCode: true,
  branchId: true,
  name: true,
  address: true,
  city: true,
  email: true,
  phone: true,
  cinFrn: true,
  incorporationDate: true,
  pan: true,
  gstin: true,
  previousAuditor: true,
  active: true,
  organisationType: { select: { key: true, label: true } },
  directors: {
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      din: true,
      phone: true,
      email: true,
      kycStatus: true,
      sortOrder: true,
    },
  },
  laws: { select: { law: { select: { key: true } } } },
  team: { select: { user: { select: { id: true, name: true } } } },
} as const;

type Row = {
  id: string;
  clientCode: string;
  branchId: string;
  name: string;
  address: string;
  city: string | null;
  email: string | null;
  phone: string | null;
  cinFrn: string | null;
  incorporationDate: Date | null;
  pan: string;
  gstin: string | null;
  previousAuditor: string | null;
  active: boolean;
  organisationType: { key: string; label: string };
  directors: {
    id: string;
    name: string;
    din: string | null;
    phone: string | null;
    email: string | null;
    kycStatus: 'DONE' | 'PENDING';
    sortOrder: number;
  }[];
  laws: { law: { key: string } }[];
  team: { user: { id: string; name: string } }[];
};

const isoDate = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);
const toDate = (s: string | null): Date | null => (s ? new Date(`${s}T00:00:00.000Z`) : null);

function toRecord(row: Row): ClientRecord {
  const team = [...row.team].sort((a, b) => a.user.name.localeCompare(b.user.name));
  return {
    id: row.id,
    clientCode: row.clientCode,
    branchId: row.branchId,
    name: row.name,
    address: row.address,
    city: row.city,
    email: row.email,
    phone: row.phone,
    organisationType: row.organisationType.key,
    organisationTypeLabel: row.organisationType.label,
    cinFrn: row.cinFrn,
    incorporationDate: isoDate(row.incorporationDate),
    pan: row.pan,
    gstin: row.gstin,
    previousAuditor: row.previousAuditor,
    active: row.active,
    directors: [...row.directors]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((d) => ({
        id: d.id,
        name: d.name,
        din: d.din,
        phone: d.phone,
        email: d.email,
        kycStatus: d.kycStatus === 'DONE' ? 'done' : 'pending',
      })),
    lawKeys: row.laws.map((l) => l.law.key).sort(),
    teamIds: team.map((t) => t.user.id),
    team: team.map((t) => t.user.name),
  };
}

const kyc = (s: KycStatusValue): 'DONE' | 'PENDING' => (s === 'done' ? 'DONE' : 'PENDING');

const ERRORS = {
  unique: 'A client with this PAN already exists',
  reference: 'The branch, organisation type, law or team member does not exist',
};

@Injectable()
export class PrismaClientsRepository extends ClientsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: RecordAuditUseCase,
  ) {
    super();
  }

  async list(query: ClientQuery): Promise<ClientPage> {
    const where = {
      deletedAt: null,
      ...(query.active === null ? {} : { active: query.active }),
      ...(query.branchIds ? { branchId: { in: query.branchIds } } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' as const } },
              { clientCode: { contains: query.q, mode: 'insensitive' as const } },
              { pan: { contains: query.q, mode: 'insensitive' as const } },
              { gstin: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.client.client.count({ where }),
      this.prisma.client.client.findMany({
        where,
        select: CLIENT_SELECT,
        orderBy: [{ clientCode: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map(toRecord),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findById(id: string, branchIds: string[] | null): Promise<ClientRecord | null> {
    const row = await this.prisma.client.client.findFirst({
      where: { id, deletedAt: null, ...(branchIds ? { branchId: { in: branchIds } } : {}) },
      select: CLIENT_SELECT,
    });
    return row && toRecord(row);
  }

  peekNextCode(): Promise<string> {
    return this.prisma.tx((tx) => peekNextCode(tx, 'client'));
  }

  async referenceData(): Promise<ReferenceData> {
    const [types, laws] = await Promise.all([
      this.prisma.client.organisationType.findMany({
        where: { deletedAt: null },
        select: { key: true, label: true },
        orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      }),
      this.prisma.client.complianceLaw.findMany({
        where: { deletedAt: null },
        select: { key: true, label: true },
        orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      }),
    ]);
    return {
      organisationTypes: types,
      laws,
      kycStatuses: [
        { key: 'done', label: 'Done' },
        { key: 'pending', label: 'Pending' },
      ],
    };
  }

  async create(
    input: ClientWrite,
    branchId: string,
    audit: ClientAuditSpec,
  ): Promise<ClientRecord> {
    try {
      return await this.prisma.tx(async (tx) => {
        const organisationTypeId = await this.organisationTypeId(tx, input.organisationType);
        const lawIds = await this.lawIds(tx, input.lawKeys);
        // The code is issued INSIDE this transaction: one atomic increment, never count + 1.
        const clientCode = await issueCode(tx, 'client');
        const created = await tx.client.create({
          data: {
            branchId,
            clientCode,
            ...this.fields(input),
            organisationTypeId,
            createdBy: audit.userId,
            updatedBy: audit.userId,
          } as never,
          select: { id: true },
        });
        await this.writeChildren(tx, created.id, input, lawIds, audit.userId);
        await this.audit.executeIn(tx, {
          ...audit,
          entity: 'client',
          entityId: created.id,
          branchId,
          changes: { clientCode, ...audit.changes },
        });
        const row = await tx.client.findFirstOrThrow({
          where: { id: created.id },
          select: CLIENT_SELECT,
        });
        return toRecord(row);
      });
    } catch (error) {
      return this.rethrow(error);
    }
  }

  async update(id: string, input: ClientWrite, audit: ClientAuditSpec): Promise<ClientRecord> {
    try {
      return await this.prisma.tx(async (tx) => {
        const organisationTypeId = await this.organisationTypeId(tx, input.organisationType);
        const lawIds = await this.lawIds(tx, input.lawKeys);
        // clientCode and branchId are never part of an update.
        await tx.client.updateMany({
          where: { id, deletedAt: null },
          data: { ...this.fields(input), organisationTypeId, updatedBy: audit.userId },
        });
        await tx.clientDirector.updateMany({
          where: { clientId: id, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        await tx.clientLaw.deleteMany({ where: { clientId: id } });
        await tx.clientTeamMember.deleteMany({ where: { clientId: id } });
        await this.writeChildren(tx, id, input, lawIds, audit.userId);
        await this.audit.executeIn(tx, { ...audit, entity: 'client', entityId: id });
        const row = await tx.client.findFirstOrThrow({ where: { id }, select: CLIENT_SELECT });
        return toRecord(row);
      });
    } catch (error) {
      return this.rethrow(error);
    }
  }

  async setActive(id: string, active: boolean, audit: ClientAuditSpec): Promise<void> {
    await this.prisma.tx(async (tx) => {
      await tx.client.updateMany({
        where: { id, deletedAt: null },
        data: { active, updatedBy: audit.userId },
      });
      await this.audit.executeIn(tx, { ...audit, entity: 'client', entityId: id });
    });
  }

  async countTouchedBy(userId: string): Promise<number> {
    const [authored, team] = await Promise.all([
      this.prisma.client.client.count({
        where: { OR: [{ createdBy: userId }, { updatedBy: userId }] },
      }),
      this.prisma.client.clientTeamMember.count({ where: { userId } }),
    ]);
    return authored + team;
  }

  private fields(input: ClientWrite) {
    return {
      name: input.name,
      address: input.address,
      city: input.city,
      email: input.email,
      phone: input.phone,
      cinFrn: input.cinFrn,
      incorporationDate: toDate(input.incorporationDate),
      pan: input.pan,
      gstin: input.gstin,
      previousAuditor: input.previousAuditor,
    };
  }

  private async organisationTypeId(tx: TenantTransaction, key: string): Promise<string> {
    const row = await tx.organisationType.findFirst({
      where: { key, deletedAt: null },
      select: { id: true },
    });
    if (!row) throw new ValidationError(`Unknown organisation type "${key}"`, 'UNKNOWN_REFERENCE');
    return row.id;
  }

  private async lawIds(tx: TenantTransaction, keys: string[]): Promise<string[]> {
    if (!keys.length) return [];
    const rows = await tx.complianceLaw.findMany({
      where: { key: { in: keys }, deletedAt: null },
      select: { id: true, key: true },
    });
    const missing = keys.filter((k) => !rows.some((r) => r.key === k));
    if (missing.length) {
      throw new ValidationError(`Unknown law: ${missing.join(', ')}`, 'UNKNOWN_REFERENCE');
    }
    return rows.map((r) => r.id);
  }

  private async writeChildren(
    tx: TenantTransaction,
    clientId: string,
    input: ClientWrite,
    lawIds: string[],
    actorId: string,
  ): Promise<void> {
    if (input.directors.length) {
      await tx.clientDirector.createMany({
        data: input.directors.map((d, index) => ({
          clientId,
          name: d.name,
          din: d.din,
          phone: d.phone,
          email: d.email,
          kycStatus: kyc(d.kycStatus),
          sortOrder: index,
          createdBy: actorId,
        })) as never,
      });
    }
    if (lawIds.length) {
      await tx.clientLaw.createMany({
        data: lawIds.map((lawId) => ({ clientId, lawId, createdBy: actorId })) as never,
      });
    }
    if (input.teamIds.length) {
      await tx.clientTeamMember.createMany({
        data: input.teamIds.map((userId) => ({ clientId, userId, createdBy: actorId })) as never,
      });
    }
  }

  private rethrow(error: unknown): never {
    return mapIntegrityError(error, ERRORS);
  }
}
