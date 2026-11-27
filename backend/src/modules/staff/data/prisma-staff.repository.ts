import { Injectable } from '@nestjs/common';
import { issueCode, peekNextCode } from '../../../core/codes/code-sequence.js';
import { mapIntegrityError } from '../../../core/database/db-errors.js';
import { PrismaService } from '../../../core/database/prisma.service.js';
import { RecordAuditUseCase } from '../../audit/domain/record-audit.use-case.js';
import {
  NewStaff,
  StaffAuditSpec,
  StaffChanges,
  StaffPage,
  StaffQuery,
  StaffRecord,
} from '../domain/staff.records.js';
import { StaffRepository } from '../domain/staff.repository.js';

const STAFF_SELECT = {
  id: true,
  employeeCode: true,
  name: true,
  email: true,
  phone: true,
  address: true,
  dateOfBirth: true,
  dateOfJoining: true,
  status: true,
  mustChangePassword: true,
  positionId: true,
  managerId: true,
  position: {
    select: {
      name: true,
      code: true,
      designationCode: true,
      departmentId: true,
      department: { select: { name: true } },
      role: { select: { name: true } },
    },
  },
  manager: { select: { name: true, employeeCode: true } },
} as const;

interface Row {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  dateOfBirth: Date | null;
  dateOfJoining: Date | null;
  status: 'ACTIVE' | 'DISABLED';
  mustChangePassword: boolean;
  positionId: string | null;
  managerId: string | null;
  position: {
    name: string;
    code: string;
    designationCode: string | null;
    departmentId: string;
    department: { name: string };
    role: { name: string } | null;
  } | null;
  manager: { name: string; employeeCode: string } | null;
}

const isoDate = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);
const toDate = (s: string | null | undefined): Date | null | undefined =>
  s === undefined ? undefined : s === null ? null : new Date(`${s}T00:00:00.000Z`);

const toRecord = (row: Row): StaffRecord => ({
  id: row.id,
  employeeCode: row.employeeCode,
  name: row.name,
  email: row.email,
  phone: row.phone,
  address: row.address,
  dateOfBirth: isoDate(row.dateOfBirth),
  dateOfJoining: isoDate(row.dateOfJoining),
  positionId: row.positionId,
  positionName: row.position?.name ?? null,
  positionCode: row.position?.code ?? null,
  designationCode: row.position?.designationCode ?? null,
  departmentId: row.position?.departmentId ?? null,
  departmentName: row.position?.department.name ?? null,
  roleName: row.position?.role?.name ?? null,
  managerId: row.managerId,
  managerName: row.manager?.name ?? null,
  managerCode: row.manager?.employeeCode ?? null,
  active: row.status === 'ACTIVE',
  mustChangePassword: row.mustChangePassword,
});

const ERRORS = {
  unique: 'Another staff member already uses this email',
  reference: 'The position, manager or branch does not exist',
};

@Injectable()
export class PrismaStaffRepository extends StaffRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: RecordAuditUseCase,
  ) {
    super();
  }

  peekNextCode(): Promise<string> {
    return this.prisma.tx((tx) => peekNextCode(tx, 'employee'));
  }

  async list(query: StaffQuery): Promise<StaffPage> {
    const where = {
      deletedAt: null,
      ...(query.active === null
        ? {}
        : { status: (query.active ? 'ACTIVE' : 'DISABLED') as 'ACTIVE' | 'DISABLED' }),
      ...(query.scopeIds ? { id: { in: query.scopeIds } } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' as const } },
              { employeeCode: { contains: query.q, mode: 'insensitive' as const } },
              { email: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.client.user.count({ where }),
      this.prisma.client.user.findMany({
        where,
        select: STAFF_SELECT,
        orderBy: [{ employeeCode: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toRecord), total, page: query.page, pageSize: query.pageSize };
  }

  async findById(id: string): Promise<StaffRecord | null> {
    const row = await this.prisma.client.user.findFirst({
      where: { id, deletedAt: null },
      select: STAFF_SELECT,
    });
    return row && toRecord(row);
  }

  subtreeIds(userId: string): Promise<string[]> {
    // Recursive CTE; raw SQL is only safe inside tx (it sets app.tenant_id for row-level security).
    return this.prisma.tx(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        WITH RECURSIVE sub AS (
          SELECT id FROM users WHERE id = ${userId}::uuid AND "deletedAt" IS NULL
          UNION
          SELECT u.id FROM users u JOIN sub ON u."managerId" = sub.id WHERE u."deletedAt" IS NULL
        )
        SELECT id FROM sub`;
      return rows.map((r) => r.id);
    });
  }

  countReports(userId: string): Promise<number> {
    return this.prisma.client.user.count({ where: { managerId: userId, deletedAt: null } });
  }

  async create(input: NewStaff, audit: StaffAuditSpec): Promise<StaffRecord> {
    try {
      return await this.prisma.tx(async (tx) => {
        // The code is issued INSIDE this transaction: one atomic increment, never count + 1.
        const employeeCode = await issueCode(tx, 'employee');
        const user = await tx.user.create({
          data: {
            email: input.email,
            name: input.name,
            employeeCode,
            phone: input.phone,
            address: input.address,
            dateOfBirth: toDate(input.dateOfBirth),
            dateOfJoining: toDate(input.dateOfJoining),
            passwordHash: input.passwordHash,
            mustChangePassword: true,
            positionId: input.positionId,
            managerId: input.managerId,
            homeBranchId: input.homeBranchId,
            createdBy: audit.userId,
          } as never,
          select: { id: true },
        });
        if (input.roleId) {
          await tx.userRole.create({
            data: { userId: user.id, roleId: input.roleId, createdBy: audit.userId } as never,
          });
        }
        if (input.branchAccessIds.length) {
          await tx.userBranchAccess.createMany({
            data: input.branchAccessIds.map((branchId) => ({
              userId: user.id,
              branchId,
              createdBy: audit.userId,
            })) as never,
          });
        }
        await this.audit.executeIn(tx, {
          ...audit,
          entity: 'user',
          entityId: user.id,
          changes: { employeeCode, ...audit.changes },
        });
        const row = await tx.user.findFirstOrThrow({
          where: { id: user.id },
          select: STAFF_SELECT,
        });
        return toRecord(row);
      });
    } catch (error) {
      return mapIntegrityError(error, ERRORS);
    }
  }

  async update(id: string, changes: StaffChanges, audit: StaffAuditSpec): Promise<StaffRecord> {
    try {
      return await this.prisma.tx(async (tx) => {
        const { roleId, ...fields } = changes;
        // employeeCode is never part of an update (and a database trigger forbids changing it).
        await tx.user.updateMany({
          where: { id, deletedAt: null },
          data: {
            ...fields,
            dateOfBirth: toDate(fields.dateOfBirth),
            dateOfJoining: toDate(fields.dateOfJoining),
          },
        });
        if (changes.positionId !== undefined) {
          // The user's role follows their position.
          await tx.userRole.deleteMany({ where: { userId: id } });
          if (roleId) {
            await tx.userRole.create({
              data: { userId: id, roleId, createdBy: audit.userId } as never,
            });
          }
        }
        await this.audit.executeIn(tx, { ...audit, entity: 'user', entityId: id });
        const row = await tx.user.findFirstOrThrow({ where: { id }, select: STAFF_SELECT });
        return toRecord(row);
      });
    } catch (error) {
      return mapIntegrityError(error, ERRORS);
    }
  }

  async setStatus(id: string, status: 'ACTIVE' | 'DISABLED', audit: StaffAuditSpec): Promise<void> {
    await this.prisma.tx(async (tx) => {
      await tx.user.updateMany({
        where: { id, deletedAt: null },
        data: status === 'ACTIVE' ? { status, failedLoginCount: 0, lockedUntil: null } : { status },
      });
      await this.audit.executeIn(tx, { ...audit, entity: 'user', entityId: id });
    });
  }

  async softDelete(id: string, audit: StaffAuditSpec): Promise<void> {
    await this.prisma.tx(async (tx) => {
      await tx.user.updateMany({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date(), status: 'DISABLED' },
      });
      await this.audit.executeIn(tx, { ...audit, entity: 'user', entityId: id });
    });
  }
}
