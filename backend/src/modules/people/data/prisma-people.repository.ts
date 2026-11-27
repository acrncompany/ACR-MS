import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError, ValidationError } from '../../../core/errors/app-error.js';
import { issueCode, peekNextCode } from '../../../core/codes/code-sequence.js';
import { mapIntegrityError } from '../../../core/database/db-errors.js';
import { PrismaService } from '../../../core/database/prisma.service.js';
import { RecordAuditUseCase } from '../../audit/domain/record-audit.use-case.js';
import { PeopleRepository } from '../domain/people.repository.js';
import {
  AdditionalDocumentInfo,
  DirectoryStatus,
  HrDepartmentRecord,
  HrDesignationRecord,
  Gender,
  HrOption,
  HrPersonDetail,
  HrPersonRecord,
  IdProofType,
  MaritalStatus,
  NewAdditionalDocument,
  NewDepartment,
  NewDesignation,
  NewPerson,
  PeopleAuditSpec,
  PeoplePage,
  PeopleQuery,
  PersonDocumentFile,
  PersonDocumentInfo,
  PersonDocumentKind,
  PersonKind,
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

const PERSON_SELECT = {
  id: true,
  code: true,
  firstName: true,
  lastName: true,
  email: true,
  mobNo: true,
  dateOfJoining: true,
  active: true,
  departmentId: true,
  department: { select: { name: true } },
  designationId: true,
  designation: { select: { name: true } },
  reportingManagerId: true,
  reportingManager: { select: { firstName: true, lastName: true } },
  dateOfBirth: true,
  gender: true,
  maritalStatus: true,
  houseName: true,
  postOffice: true,
  district: true,
  pinCode: true,
  state: true,
  emergencyContactName: true,
  emergencyContactRelation: true,
  emergencyMobNo: true,
  idProofType: true,
  idProofFileName: true,
  idProofFileMime: true,
  resumeFileName: true,
  resumeFileMime: true,
  bankAccountHolder: true,
  bankName: true,
  bankAccountNumber: true,
  bankIfsc: true,
  bankBranch: true,
  passbookFileName: true,
  passbookFileMime: true,
  additionalDocuments: {
    where: { deletedAt: null },
    select: { id: true, title: true, fileName: true, fileMime: true },
    orderBy: [{ createdAt: 'asc' }],
  },
} as const;

/** Column names of each document: key, original name and type. */
const DOCUMENT_COLUMNS: Record<PersonDocumentKind, { key: string; name: string; mime: string }> = {
  'id-proof': { key: 'idProofFileKey', name: 'idProofFileName', mime: 'idProofFileMime' },
  resume: { key: 'resumeFileKey', name: 'resumeFileName', mime: 'resumeFileMime' },
  passbook: { key: 'passbookFileKey', name: 'passbookFileName', mime: 'passbookFileMime' },
};

type DepartmentRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  active: boolean;
};
type DesignationRow = DepartmentRow & { departmentId: string; department: { name: string } };
type PersonRow = {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  email: string;
  mobNo: string;
  dateOfJoining: Date;
  active: boolean;
  departmentId: string | null;
  department: { name: string } | null;
  designationId: string | null;
  designation: { name: string } | null;
  reportingManagerId: string | null;
  reportingManager: { firstName: string; lastName: string } | null;
  dateOfBirth: Date | null;
  gender: Gender | null;
  maritalStatus: MaritalStatus | null;
  houseName: string;
  postOffice: string;
  district: string;
  pinCode: string;
  state: string;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyMobNo: string;
  idProofType: IdProofType | null;
  idProofFileName: string | null;
  idProofFileMime: string | null;
  resumeFileName: string | null;
  resumeFileMime: string | null;
  bankAccountHolder: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankBranch: string;
  passbookFileName: string | null;
  passbookFileMime: string | null;
  additionalDocuments: { id: string; title: string; fileName: string; fileMime: string }[];
};

/** The part of the Prisma employee/article delegates this repository uses. */
interface PersonDelegate {
  count(args: unknown): Promise<number>;
  findMany(args: unknown): Promise<PersonRow[]>;
  findFirst(args: unknown): Promise<PersonRow | null>;
  create(args: unknown): Promise<PersonRow>;
  updateMany(args: unknown): Promise<{ count: number }>;
}

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

/** First and last name together; the last name may be empty. */
const fullName = (p: { firstName: string; lastName: string }): string =>
  `${p.firstName} ${p.lastName}`.trim();

const toPerson = (r: PersonRow): HrPersonRecord => ({
  id: r.id,
  code: r.code,
  firstName: r.firstName,
  lastName: r.lastName,
  name: fullName(r),
  email: r.email,
  mobNo: r.mobNo,
  departmentId: r.departmentId,
  departmentName: r.department?.name ?? null,
  designationId: r.designationId,
  designationName: r.designation?.name ?? null,
  reportingManagerId: r.reportingManagerId,
  reportingManagerName: r.reportingManager ? fullName(r.reportingManager) : null,
  joinDate: isoDate(r.dateOfJoining),
  status: status(r.active),
});

const documentInfo = (name: string | null, mime: string | null): PersonDocumentInfo | null =>
  name && mime ? { fileName: name, mime } : null;

const toPersonDetail = (r: PersonRow): HrPersonDetail => ({
  ...toPerson(r),
  dateOfBirth: r.dateOfBirth ? isoDate(r.dateOfBirth) : null,
  gender: r.gender,
  maritalStatus: r.maritalStatus,
  address: {
    houseName: r.houseName,
    postOffice: r.postOffice,
    district: r.district,
    pinCode: r.pinCode,
    state: r.state,
  },
  emergencyContact: {
    name: r.emergencyContactName,
    relation: r.emergencyContactRelation,
    mobNo: r.emergencyMobNo,
  },
  idProofType: r.idProofType,
  bank: {
    accountHolder: r.bankAccountHolder,
    bankName: r.bankName,
    accountNumber: r.bankAccountNumber,
    ifsc: r.bankIfsc,
    branch: r.bankBranch,
  },
  documents: {
    idProof: documentInfo(r.idProofFileName, r.idProofFileMime),
    resume: documentInfo(r.resumeFileName, r.resumeFileMime),
    passbook: documentInfo(r.passbookFileName, r.passbookFileMime),
  },
  additionalDocuments: r.additionalDocuments.map((d) => ({
    id: d.id,
    title: d.title,
    fileName: d.fileName,
    mime: d.fileMime,
  })),
});

const dateOrNull = (iso: string | null): Date | null =>
  iso ? new Date(`${iso}T00:00:00.000Z`) : null;

/** Case-insensitive "contains" over the given text columns. */
function search(q: string | null, fields: string[]): object {
  if (!q) return {};
  return {
    OR: fields.map((f) => ({ [f]: { contains: q, mode: 'insensitive' as const } })),
  };
}

/** Every editable column of an employee or article (same for create and update). */
const personFields = (input: NewPerson) => ({
  firstName: input.firstName,
  lastName: input.lastName,
  email: input.email,
  mobNo: input.mobNo,
  departmentId: input.departmentId,
  designationId: input.designationId,
  reportingManagerId: input.reportingManagerId,
  dateOfJoining: dateOrNull(input.joinDate),
  dateOfBirth: dateOrNull(input.dateOfBirth),
  gender: input.gender,
  maritalStatus: input.maritalStatus,
  houseName: input.address.houseName,
  postOffice: input.address.postOffice,
  district: input.address.district,
  pinCode: input.address.pinCode,
  state: input.address.state,
  emergencyContactName: input.emergencyContact.name,
  emergencyContactRelation: input.emergencyContact.relation,
  emergencyMobNo: input.emergencyContact.mobNo,
  idProofType: input.idProofType,
  bankAccountHolder: input.bank.accountHolder,
  bankName: input.bank.bankName,
  bankAccountNumber: input.bank.accountNumber,
  bankIfsc: input.bank.ifsc,
  bankBranch: input.bank.branch,
  active: input.status === 'Active',
});

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

  /** Employees and articles live in two tables with the same shape. */
  private delegate(tx: { employee: unknown; article: unknown }, kind: PersonKind): PersonDelegate {
    return (kind === 'employee' ? tx.employee : tx.article) as PersonDelegate;
  }

  async listPeople(kind: PersonKind, query: PeopleQuery): Promise<PeoplePage<HrPersonRecord>> {
    const where = {
      deletedAt: null,
      ...(query.q
        ? {
            OR: [
              { firstName: { contains: query.q, mode: 'insensitive' as const } },
              { lastName: { contains: query.q, mode: 'insensitive' as const } },
              { code: { contains: query.q, mode: 'insensitive' as const } },
              { email: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const person = this.delegate(this.prisma.client, kind);
    const [total, rows] = await Promise.all([
      person.count({ where }),
      person.findMany({
        where,
        select: PERSON_SELECT,
        orderBy: [{ code: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items: rows.map(toPerson), total, page: query.page, pageSize: query.pageSize };
  }

  async findPerson(kind: PersonKind, id: string): Promise<HrPersonDetail | null> {
    const row = await this.delegate(this.prisma.client, kind).findFirst({
      where: { id, deletedAt: null },
      select: PERSON_SELECT,
    });
    return row ? toPersonDetail(row) : null;
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

  async employeeOptions(): Promise<HrOption[]> {
    const rows = await this.prisma.client.employee.findMany({
      where: { deletedAt: null, active: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    return rows.map((r) => ({ id: r.id, name: fullName(r) }));
  }

  // ---------------------------------------------------------------- code previews
  peekDepartmentCode(): Promise<string> {
    return this.prisma.tx((tx) => peekNextCode(tx, 'hrDepartment'));
  }

  peekDesignationCode(): Promise<string> {
    return this.prisma.tx((tx) => peekNextCode(tx, 'hrDesignation'));
  }

  peekPersonCode(kind: PersonKind): Promise<string> {
    // Employees and articles share one series: the kind does not matter here.
    void kind;
    return this.prisma.tx((tx) => peekNextCode(tx, 'hrPerson'));
  }

  // ---------------------------------------------------------------- reference checks
  async activeDepartmentExists(id: string): Promise<boolean> {
    const row = await this.prisma.client.department.findFirst({
      where: { id, deletedAt: null, active: true },
      select: { id: true },
    });
    return row !== null;
  }

  async activeEmployeeExists(id: string): Promise<boolean> {
    const row = await this.prisma.client.employee.findFirst({
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

  async createPerson(
    kind: PersonKind,
    input: NewPerson,
    audit: PeopleAuditSpec,
  ): Promise<HrPersonDetail> {
    try {
      return await this.prisma.tx(async (tx) => {
        const code = await issueCode(tx, 'hrPerson');
        const created = await this.delegate(tx, kind).create({
          data: {
            code,
            ...personFields(input),
            createdBy: audit.userId,
          },
          select: PERSON_SELECT,
        });
        await this.audit.executeIn(tx, {
          ...audit,
          entity: kind === 'employee' ? 'hr_employee' : 'hr_article',
          entityId: created.id,
          changes: { code, ...audit.changes },
        });
        return toPersonDetail(created);
      });
    } catch (error) {
      return mapIntegrityError(error, {
        unique: 'A record with these details already exists',
        reference: 'Unknown department, designation or reporting manager',
      });
    }
  }

  async updatePerson(
    kind: PersonKind,
    id: string,
    input: NewPerson,
    audit: PeopleAuditSpec,
  ): Promise<HrPersonDetail> {
    try {
      return await this.prisma.tx(async (tx) => {
        const person = this.delegate(tx, kind);
        const before = await person.findFirst({
          where: { id, deletedAt: null },
          select: { id: true },
        });
        if (!before) throw new NotFoundError('Record not found');
        if (kind === 'employee' && input.reportingManagerId) {
          // Nobody may end up (indirectly) reporting to themselves.
          let cursor: string | null = input.reportingManagerId;
          for (let hops = 0; cursor && hops < 100; hops++) {
            if (cursor === id) {
              throw new ValidationError(
                'This would make the employee report to themselves',
                'REPORTING_CYCLE',
              );
            }
            const next: { reportingManagerId: string | null } | null = await tx.employee.findFirst({
              where: { id: cursor },
              select: { reportingManagerId: true },
            });
            cursor = next?.reportingManagerId ?? null;
          }
        }
        await person.updateMany({
          where: { id, deletedAt: null },
          data: { ...personFields(input), updatedAt: new Date() },
        });
        await this.audit.executeIn(tx, {
          ...audit,
          entity: kind === 'employee' ? 'hr_employee' : 'hr_article',
          entityId: id,
        });
        const updated = await person.findFirst({
          where: { id, deletedAt: null },
          select: PERSON_SELECT,
        });
        if (!updated) throw new NotFoundError('Record not found');
        return toPersonDetail(updated);
      });
    } catch (error) {
      return mapIntegrityError(error, {
        unique: 'A record with these details already exists',
        reference: 'Unknown department, designation or reporting manager',
      });
    }
  }

  async hardDeletePerson(kind: PersonKind, id: string, audit: PeopleAuditSpec): Promise<string[]> {
    try {
      return await this.prisma.tx(async (tx) => {
        const person = this.delegate(tx, kind);
        const row = (await person.findFirst({
          where: { id },
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
            idProofFileKey: true,
            resumeFileKey: true,
            passbookFileKey: true,
          },
        })) as unknown as {
          code: string;
          firstName: string;
          lastName: string;
          idProofFileKey: string | null;
          resumeFileKey: string | null;
          passbookFileKey: string | null;
        } | null;
        if (!row) throw new NotFoundError('Record not found');
        if (kind === 'employee') {
          const [reports, articles] = await Promise.all([
            tx.employee.count({ where: { reportingManagerId: id } }),
            tx.article.count({ where: { reportingManagerId: id } }),
          ]);
          if (reports + articles > 0) {
            throw new ConflictError(
              'This employee is the reporting manager of other records. Change or delete those first.',
            );
          }
        }
        const owner = kind === 'employee' ? { employeeId: id } : { articleId: id };
        const extras = await tx.personDocument.findMany({
          where: owner,
          select: { fileKey: true },
        });
        await tx.personDocument.deleteMany({ where: owner });
        await (person as unknown as { delete(args: unknown): Promise<unknown> }).delete({
          where: { id },
        });
        await this.audit.executeIn(tx, {
          ...audit,
          entity: kind === 'employee' ? 'hr_employee' : 'hr_article',
          entityId: id,
          changes: { code: row.code, name: fullName(row), ...audit.changes },
        });
        return [
          row.idProofFileKey,
          row.resumeFileKey,
          row.passbookFileKey,
          ...extras.map((d) => d.fileKey),
        ].filter((key): key is string => !!key);
      });
    } catch (error) {
      return mapIntegrityError(error, {
        unique: 'Cannot delete this record',
        reference: 'This record is still referenced by other records',
      });
    }
  }

  // ---------------------------------------------------------------- documents
  async findDocument(
    kind: PersonKind,
    id: string,
    docKind: PersonDocumentKind,
  ): Promise<PersonDocumentFile | null> {
    const cols = DOCUMENT_COLUMNS[docKind];
    const row = (await this.delegate(this.prisma.client, kind).findFirst({
      where: { id, deletedAt: null },
      select: { [cols.key]: true, [cols.name]: true, [cols.mime]: true },
    })) as Record<string, string | null> | null;
    const key = row?.[cols.key];
    const fileName = row?.[cols.name];
    const mime = row?.[cols.mime];
    return key && fileName && mime ? { key, fileName, mime } : null;
  }

  async setDocument(
    kind: PersonKind,
    id: string,
    docKind: PersonDocumentKind,
    file: PersonDocumentFile,
    audit: PeopleAuditSpec,
  ): Promise<{ previousKey: string | null }> {
    const cols = DOCUMENT_COLUMNS[docKind];
    return this.prisma.tx(async (tx) => {
      const person = this.delegate(tx, kind);
      const before = (await person.findFirst({
        where: { id, deletedAt: null },
        select: { [cols.key]: true },
      })) as Record<string, string | null> | null;
      if (!before) throw new NotFoundError('Record not found');
      await person.updateMany({
        where: { id, deletedAt: null },
        data: { [cols.key]: file.key, [cols.name]: file.fileName, [cols.mime]: file.mime },
      });
      await this.audit.executeIn(tx, {
        ...audit,
        entity: kind === 'employee' ? 'hr_employee' : 'hr_article',
        entityId: id,
        // The file name and type only: never the file or its storage key.
        changes: { document: docKind, fileName: file.fileName, mime: file.mime },
      });
      return { previousKey: before[cols.key] ?? null };
    });
  }

  // ---------------------------------------------------------------- additional documents
  async countAdditionalDocuments(kind: PersonKind, id: string): Promise<number> {
    return this.prisma.client.personDocument.count({
      where: { deletedAt: null, ...(kind === 'employee' ? { employeeId: id } : { articleId: id }) },
    });
  }

  async addAdditionalDocument(
    kind: PersonKind,
    id: string,
    document: NewAdditionalDocument,
    audit: PeopleAuditSpec,
  ): Promise<AdditionalDocumentInfo> {
    return this.prisma.tx(async (tx) => {
      const owner = await this.delegate(tx, kind).findFirst({
        where: { id, deletedAt: null },
        select: { id: true },
      });
      if (!owner) throw new NotFoundError('Record not found');
      const created = await tx.personDocument.create({
        data: {
          ...(kind === 'employee' ? { employeeId: id } : { articleId: id }),
          title: document.title,
          fileKey: document.key,
          fileName: document.fileName,
          fileMime: document.mime,
          createdBy: audit.userId,
        } as never,
        select: { id: true, title: true, fileName: true, fileMime: true },
      });
      await this.audit.executeIn(tx, {
        ...audit,
        entity: kind === 'employee' ? 'hr_employee' : 'hr_article',
        entityId: id,
        // The title and file name only: never the file or its storage key.
        changes: {
          additionalDocument: created.id,
          title: document.title,
          fileName: document.fileName,
        },
      });
      return {
        id: created.id,
        title: created.title,
        fileName: created.fileName,
        mime: created.fileMime,
      };
    });
  }

  async findAdditionalDocument(
    kind: PersonKind,
    id: string,
    documentId: string,
  ): Promise<PersonDocumentFile | null> {
    const row = await this.prisma.client.personDocument.findFirst({
      where: {
        id: documentId,
        deletedAt: null,
        ...(kind === 'employee' ? { employeeId: id } : { articleId: id }),
      },
      select: { fileKey: true, fileName: true, fileMime: true },
    });
    return row ? { key: row.fileKey, fileName: row.fileName, mime: row.fileMime } : null;
  }
}
