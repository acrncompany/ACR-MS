import { Injectable } from '@nestjs/common';
import type { TenantTransaction } from '../../../core/database/prisma.service.js';
import { PrismaService } from '../../../core/database/prisma.service.js';
import { AuditEntry, AuditRepository, AuditRow } from '../domain/audit.repository.js';

type AuditCreateData = Parameters<PrismaService['client']['auditLog']['create']>[0]['data'];

const ROW_SELECT = {
  id: true,
  createdAt: true,
  action: true,
  userId: true,
  entityId: true,
  changes: true,
  user: { select: { name: true } },
} as const;

type Row = {
  id: string;
  createdAt: Date;
  action: string;
  userId: string | null;
  entityId: string | null;
  changes: unknown;
  user: { name: string } | null;
};

const toRow = (r: Row): AuditRow => ({
  id: r.id,
  at: r.createdAt,
  action: r.action,
  userId: r.userId,
  userName: r.user?.name ?? null,
  entityId: r.entityId,
  changes: (r.changes as Record<string, unknown> | null) ?? null,
});

function data(entry: AuditEntry): AuditCreateData {
  // tenantId is added by the tenant-scope extension.
  return {
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    userId: entry.userId ?? null,
    branchId: entry.branchId ?? null,
    changes: entry.changes ?? undefined,
    ip: entry.ip ?? null,
  } as unknown as AuditCreateData;
}

@Injectable()
export class PrismaAuditRepository extends AuditRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.client.auditLog.create({ data: data(entry) });
  }

  async recordIn(tx: TenantTransaction, entry: AuditEntry): Promise<void> {
    await tx.auditLog.create({ data: data(entry) });
  }

  async listForEntity(
    entity: string,
    entityId: string,
    actions: string[] | null,
    limit: number,
  ): Promise<AuditRow[]> {
    const rows = await this.prisma.client.auditLog.findMany({
      where: { entity, entityId, ...(actions ? { action: { in: actions } } : {}) },
      select: ROW_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows.map(toRow);
  }

  async listByActorSince(userId: string, actions: string[], since: Date): Promise<AuditRow[]> {
    const rows = await this.prisma.client.auditLog.findMany({
      where: { userId, action: { in: actions }, createdAt: { gte: since } },
      select: ROW_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toRow);
  }

  countByActor(userId: string): Promise<number> {
    return this.prisma.client.auditLog.count({ where: { userId } });
  }
}
