import { Injectable } from '@nestjs/common';
import { issueCode, peekNextCode } from '../../../core/codes/code-sequence.js';
import { mapIntegrityError } from '../../../core/database/db-errors.js';
import { PrismaService } from '../../../core/database/prisma.service.js';
import { RecordAuditUseCase } from '../../audit/domain/record-audit.use-case.js';
import { PeopleRepository } from '../domain/people.repository.js';
import {
  DirectoryStatus,
  HrDepartmentRecord,
  HrDesignationRecord,
  HrEmployeeRecord,
  HrOption,
  NewDepartment,
  NewDesignation,
  NewEmployee,
  PeopleAuditSpec,
  PeoplePage,
  PeopleQuery,
} from '../domain/people.records.js';

const status = (active: boolean): DirectoryStatus => (active ? 'Active' : 'Inactive');
const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

const DEPARTMENT_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  active: true,
} as const;

const DESIGNATION_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  active: true,
  departmentId: true,
  department: { select: { name: true } },
} as const;

const EMPLOYEE_SELECT = {
  id: true,
  code: true,
  name: true,
  email: true,
  phone: true,
  dateOfJoining: true,
  active: true,
  departmentId: true,
  department: { select: { name: true } },
  designationId: true,
  designation: { select: { name: true } },
} as const;

type DepartmentRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  active: boolean;
};
type DesignationRow = DepartmentRow & { departmentId: string; department: { name: string } };
type EmployeeRow = {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  dateOfJoining: Date;
  active: boolean;
  departmentId: string | null;
  department: { name: string } | null;
  designationId: string | null;
  designation: { name: string } | null;
};

const toDepartment = (r: DepartmentRow): HrDepartmentRecord => ({
  id: r.id,
  code: r.code,
  name: r.name,
  description: r.description,
  status: status(r.active),
});

const toDesignation = (r: DesignationRow): HrDesignationRecord => ({
  id: r.id,
  code: r.code,
  name: r.name,
  departmentId: r.departmentId,
  departmentName: r.department.name,
  description: r.description,
  status: status(r.active),
});

const toEmployee = (r: EmployeeRow): HrEmployeeRecord => ({
  id: r.id,
  code: r.code,
  name: r.name,
  email: r.email,
  phone: r.phone,
  departmentId: r.departmentId,
  departmentName: r.department?.name ?? null,
  designationId: r.designationId,
  designationName: r.designation?.name ?? null,
  joinDate: isoDate(r.dateOfJoining),
  status: status(r.active),
});

/** Case-insensitive "contains" over the given text columns. */
function search(q: string | null, fields: string[]): object {
  if (!q) return {};
  return {
    OR: fields.map((f) => ({ [f]: { contains: q, mode: 'insensitive' as const } })),
  };
}

@Injectable()
export class PrismaPeopleRepository extends PeopleRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: RecordAuditUseCase,
  ) {
    super();
  }

  // ---------------------------------------------------------------- lists
  async listDepartments(query: PeopleQuery): Promise<PeoplePage<HrDepartmentRecord>> {
    const where = { deletedAt: null, ...search(query.q, ['name', 'code']) };
    const [total, rows] = await Promise.all([
      this.prisma.client.department.count({ where }),
      this.prisma.client.department.findMany({
        where,
        select: DEPARTMENT_SELECT,
        orderBy: [{ code: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toDepartment), total, page: query.page, pageSize: query.pageSize };
  }

  async listDesignations(query: PeopleQuery): Promise<PeoplePage<HrDesignationRecord>> {
    const where = {
      deletedAt: null,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' as const } },
              { code: { contains: query.q, mode: 'insensitive' as const } },
              { department: { name: { contains: query.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.client.designation.count({ where }),
      this.prisma.client.designation.findMany({
        where,
        select: DESIGNATION_SELECT,
        orderBy: [{ code: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toDesignation), total, page: query.page, pageSize: query.pageSize };
  }

  async listEmployees(query: PeopleQuery): Promise<PeoplePage<HrEmployeeRecord>> {
    const where = {
      deletedAt: null,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' as const } },
              { code: { contains: query.q, mode: 'insensitive' as const } },
              { email: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.client.employee.count({ where }),
      this.prisma.client.employee.findMany({
        where,
        select: EMPLOYEE_SELECT,
        orderBy: [{ code: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toEmployee), total, page: query.page, pageSize: query.pageSize };
  }

  // ---------------------------------------------------------------- dropdowns
  async departmentOptions(): Promise<HrOption[]> {
    return this.prisma.client.department.findMany({
      where: { deletedAt: null, active: true },
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }],
    });
  }

  async designationOptions(): Promise<HrOption[]> {
    return this.prisma.client.designation.findMany({
      where: { deletedAt: null, active: true },
      select: { id: true, name: true, departmentId: true },
      orderBy: [{ name: 'asc' }],
    });
  }

  // ---------------------------------------------------------------- code previews
  peekDepartmentCode(): Promise<string> {
    return this.prisma.tx((tx) => peekNextCode(tx, 'hrDepartment'));
  }

  peekDesignationCode(): Promise<string> {
    return this.prisma.tx((tx) => peekNextCode(tx, 'hrDesignation'));
  }

  peekEmployeeCode(): Promise<string> {
    return this.prisma.tx((tx) => peekNextCode(tx, 'hrEmployee'));
  }

  // ---------------------------------------------------------------- reference checks
  async activeDepartmentExists(id: string): Promise<boolean> {
    const row = await this.prisma.client.department.findFirst({
      where: { id, deletedAt: null, active: true },
      select: { id: true },
    });
    return row !== null;
  }

  async activeDesignationDepartment(id: string): Promise<{ departmentId: string } | null> {
    return this.prisma.client.designation.findFirst({
      where: { id, deletedAt: null, active: true },
      select: { departmentId: true },
    });
  }

  // ---------------------------------------------------------------- creates
  async createDepartment(
    input: NewDepartment,
    audit: PeopleAuditSpec,
  ): Promise<HrDepartmentRecord> {
    try {
      return await this.prisma.tx(async (tx) => {
        // The code is issued INSIDE this transaction: one atomic increment, never count + 1.
        const code = await issueCode(tx, 'hrDepartment');
        const created = await tx.department.create({
          data: {
            code,
            name: input.name,
            description: input.description,
            active: input.status === 'Active',
            createdBy: audit.userId,
          } as never,
          select: DEPARTMENT_SELECT,
        });
        await this.audit.executeIn(tx, {
          ...audit,
          entity: 'hr_department',
          entityId: created.id,
          changes: { code, ...audit.changes },
        });
        return toDepartment(created);
      });
    } catch (error) {
      return mapIntegrityError(error, {
        unique: 'A department with this name already exists',
        reference: 'Unknown reference',
      });
    }
  }

  async createDesignation(
    input: NewDesignation,
    audit: PeopleAuditSpec,
  ): Promise<HrDesignationRecord> {
    try {
      return await this.prisma.tx(async (tx) => {
        const code = await issueCode(tx, 'hrDesignation');
        const created = await tx.designation.create({
          data: {
            code,
            name: input.name,
            departmentId: input.departmentId,
            description: input.description,
            active: input.status === 'Active',
            createdBy: audit.userId,
          } as never,
          select: DESIGNATION_SELECT,
        });
        await this.audit.executeIn(tx, {
          ...audit,
          entity: 'hr_designation',
          entityId: created.id,
          changes: { code, ...audit.changes },
        });
        return toDesignation(created);
      });
    } catch (error) {
      return mapIntegrityError(error, {
        unique: 'This department already has a designation with this name',
        reference: 'Unknown department',
      });
    }
  }

  async createEmployee(input: NewEmployee, audit: PeopleAuditSpec): Promise<HrEmployeeRecord> {
    try {
      return await this.prisma.tx(async (tx) => {
        const code = await issueCode(tx, 'hrEmployee');
        const created = await tx.employee.create({
          data: {
            code,
            name: input.name,
            email: input.email,
            phone: input.phone,
            departmentId: input.departmentId,
            designationId: input.designationId,
            dateOfJoining: new Date(`${input.joinDate}T00:00:00.000Z`),
            active: input.status === 'Active',
            createdBy: audit.userId,
          } as never,
          select: EMPLOYEE_SELECT,
        });
        await this.audit.executeIn(tx, {
          ...audit,
          entity: 'hr_employee',
          entityId: created.id,
          changes: { code, ...audit.changes },
        });
        return toEmployee(created);
      });
    } catch (error) {
      return mapIntegrityError(error, {
        unique: 'An employee with these details already exists',
        reference: 'Unknown department or designation',
      });
    }
  }
}
