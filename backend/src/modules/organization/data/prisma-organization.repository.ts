import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service.js';
import { mapIntegrityError } from '../../../core/database/db-errors.js';
import { RecordAuditUseCase } from '../../audit/domain/record-audit.use-case.js';
import { OrganizationRepository, UserOrgContext } from '../domain/organization.repository.js';
import { AuditSpec, DepartmentRecord, PositionRecord } from '../domain/organization.records.js';

const BRANCH_SELECT = { id: true, code: true, name: true } as const;

const DEPARTMENT_SELECT = { id: true, code: true, name: true, parentId: true } as const;

const POSITION_SELECT = {
  id: true,
  code: true,
  name: true,
  designationCode: true,
  departmentId: true,
  parentPositionId: true,
  roleId: true,
  seesAll: true,
  allBranches: true,
} as const;

type PositionRow = {
  id: string;
  code: string;
  name: string;
  designationCode: string | null;
  departmentId: string;
  parentPositionId: string | null;
  roleId: string | null;
  seesAll: boolean;
  allBranches: boolean;
};

const toPosition = ({ parentPositionId, ...rest }: PositionRow): PositionRecord => ({
  ...rest,
  parentId: parentPositionId,
});

const DEPARTMENT_ERRORS = {
  unique: 'A department with this code already exists',
  reference: 'The parent department does not exist',
};
const POSITION_ERRORS = {
  unique: 'A position with this code already exists',
  reference: 'The department, parent position or role does not exist',
};

@Injectable()
export class PrismaOrganizationRepository extends OrganizationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: RecordAuditUseCase,
  ) {
    super();
  }

  listDepartments(): Promise<DepartmentRecord[]> {
    return this.prisma.client.orgDepartment.findMany({
      where: { deletedAt: null },
      select: DEPARTMENT_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  async listPositions(): Promise<PositionRecord[]> {
    const rows = await this.prisma.client.orgPosition.findMany({
      where: { deletedAt: null },
      select: POSITION_SELECT,
      orderBy: { name: 'asc' },
    });
    return rows.map(toPosition);
  }

  findDepartment(id: string): Promise<DepartmentRecord | null> {
    return this.prisma.client.orgDepartment.findFirst({
      where: { id, deletedAt: null },
      select: DEPARTMENT_SELECT,
    });
  }

  async findPosition(id: string): Promise<PositionRecord | null> {
    const row = await this.prisma.client.orgPosition.findFirst({
      where: { id, deletedAt: null },
      select: POSITION_SELECT,
    });
    return row && toPosition(row);
  }

  async createDepartment(
    input: { code: string; name: string; parentId: string | null },
    audit: AuditSpec,
  ): Promise<DepartmentRecord> {
    try {
      return await this.prisma.tx(async (tx) => {
        const row = await tx.orgDepartment.create({
          data: { ...input, createdBy: audit.userId } as never,
          select: DEPARTMENT_SELECT,
        });
        await this.audit.executeIn(tx, { ...audit, entity: 'department', entityId: row.id });
        return row;
      });
    } catch (error) {
      return mapIntegrityError(error, DEPARTMENT_ERRORS);
    }
  }

  async updateDepartment(
    id: string,
    input: { name: string; parentId: string | null },
    audit: AuditSpec,
  ): Promise<DepartmentRecord> {
    try {
      return await this.prisma.tx(async (tx) => {
        await tx.orgDepartment.updateMany({ where: { id, deletedAt: null }, data: input });
        const row = await tx.orgDepartment.findFirstOrThrow({
          where: { id },
          select: DEPARTMENT_SELECT,
        });
        await this.audit.executeIn(tx, { ...audit, entity: 'department', entityId: id });
        return row;
      });
    } catch (error) {
      return mapIntegrityError(error, DEPARTMENT_ERRORS);
    }
  }

  async createPosition(
    input: {
      code: string;
      name: string;
      designationCode: string | null;
      departmentId: string;
      parentId: string | null;
      roleId: string;
    },
    audit: AuditSpec,
  ): Promise<PositionRecord> {
    const { parentId, ...rest } = input;
    try {
      return await this.prisma.tx(async (tx) => {
        const row = await tx.orgPosition.create({
          data: { ...rest, parentPositionId: parentId, createdBy: audit.userId } as never,
          select: POSITION_SELECT,
        });
        await this.audit.executeIn(tx, { ...audit, entity: 'position', entityId: row.id });
        return toPosition(row);
      });
    } catch (error) {
      return mapIntegrityError(error, POSITION_ERRORS);
    }
  }

  async updatePosition(
    id: string,
    input: {
      name: string;
      designationCode: string | null;
      departmentId: string;
      parentId: string | null;
      roleId: string;
    },
    audit: AuditSpec,
  ): Promise<PositionRecord> {
    const { parentId, ...rest } = input;
    try {
      return await this.prisma.tx(async (tx) => {
        await tx.orgPosition.updateMany({
          where: { id, deletedAt: null },
          data: { ...rest, parentPositionId: parentId },
        });
        const row = await tx.orgPosition.findFirstOrThrow({ where: { id }, select: POSITION_SELECT });
        await this.audit.executeIn(tx, { ...audit, entity: 'position', entityId: id });
        return toPosition(row);
      });
    } catch (error) {
      return mapIntegrityError(error, POSITION_ERRORS);
    }
  }

  async findUserOrgContext(userId: string, positionId: string | null): Promise<UserOrgContext> {
    const position = positionId
      ? await this.prisma.client.orgPosition.findFirst({
          where: { id: positionId, deletedAt: null },
          select: {
            id: true,
            code: true,
            name: true,
            seesAll: true,
            allBranches: true,
            department: { select: { id: true, code: true, name: true } },
          },
        })
      : null;

    const home = await this.prisma.client.user.findFirst({
      where: { id: userId },
      select: { homeBranchId: true },
    });

    const branches = position?.allBranches
      ? await this.prisma.client.branch.findMany({
          where: { deletedAt: null, status: 'ACTIVE' },
          select: BRANCH_SELECT,
          orderBy: { name: 'asc' },
        })
      : (
          await this.prisma.client.userBranchAccess.findMany({
            where: { userId, branch: { deletedAt: null, status: 'ACTIVE' } },
            select: { branch: { select: BRANCH_SELECT } },
          })
        )
          .map((row) => row.branch)
          .sort((a, b) => a.name.localeCompare(b.name));

    return {
      position: position
        ? {
            id: position.id,
            code: position.code,
            name: position.name,
            seesAll: position.seesAll,
            allBranches: position.allBranches,
          }
        : null,
      department: position?.department ?? null,
      branches,
      homeBranchId: home?.homeBranchId ?? null,
    };
  }
}
