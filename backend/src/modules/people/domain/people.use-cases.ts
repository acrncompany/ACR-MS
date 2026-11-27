import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../core/errors/app-error.js';
import { AppConfig } from '../../../core/config/app-config.js';
import { FileStorage } from '../../../core/storage/file-storage.js';
import {
  extensionOf,
  validateUpload,
  type UploadMime,
} from '../../../core/storage/uploaded-file.js';
import { TenantContext } from '../../../core/tenant/tenant-context.js';
import type { Actor } from '../../access/domain/actor.js';
import { PeopleRepository } from './people.repository.js';
import {
  AdditionalDocumentInfo,
  HrDepartmentRecord,
  HrDesignationRecord,
  HrOption,
  HrPersonDetail,
  HrPersonRecord,
  NewDepartment,
  NewDesignation,
  NewPerson,
  PeoplePage,
  PeopleQuery,
  PersonDocumentFile,
  PersonDocumentKind,
  PersonKind,
} from './people.records.js';

@Injectable()
export class ListHrDepartmentsUseCase {
  constructor(private readonly people: PeopleRepository) {}

  execute(query: PeopleQuery): Promise<PeoplePage<HrDepartmentRecord>> {
    return this.people.listDepartments(query);
  }
}

@Injectable()
export class ListHrDesignationsUseCase {
  constructor(private readonly people: PeopleRepository) {}

  execute(query: PeopleQuery): Promise<PeoplePage<HrDesignationRecord>> {
    return this.people.listDesignations(query);
  }
}

/** Employees or articles (same profile, two tables). */
@Injectable()
export class ListHrPeopleUseCase {
  constructor(private readonly people: PeopleRepository) {}

  execute(kind: PersonKind, query: PeopleQuery): Promise<PeoplePage<HrPersonRecord>> {
    return this.people.listPeople(kind, query);
  }
}

@Injectable()
export class GetHrPersonUseCase {
  constructor(private readonly people: PeopleRepository) {}

  async execute(kind: PersonKind, id: string): Promise<HrPersonDetail> {
    const person = await this.people.findPerson(kind, id);
    if (!person) throw new NotFoundError('Record not found');
    return person;
  }
}

@Injectable()
export class ListHrOptionsUseCase {
  constructor(private readonly people: PeopleRepository) {}

  departments(): Promise<HrOption[]> {
    return this.people.departmentOptions();
  }

  designations(): Promise<HrOption[]> {
    return this.people.designationOptions();
  }

  /** Active employees: the possible reporting managers. */
  employees(): Promise<HrOption[]> {
    return this.people.employeeOptions();
  }
}

/** Previews for the "add" forms. The real code is issued when the row is saved. */
@Injectable()
export class PeekHrCodeUseCase {
  constructor(private readonly people: PeopleRepository) {}

  async execute(kind: 'department' | 'designation' | PersonKind): Promise<{ code: string }> {
    const code =
      kind === 'department'
        ? await this.people.peekDepartmentCode()
        : kind === 'designation'
          ? await this.people.peekDesignationCode()
          : await this.people.peekPersonCode(kind);
    return { code };
  }
}

@Injectable()
export class CreateHrDepartmentUseCase {
  constructor(private readonly people: PeopleRepository) {}

  execute(actor: Actor, input: NewDepartment): Promise<HrDepartmentRecord> {
    return this.people.createDepartment(input, {
      action: 'hr.department.create',
      userId: actor.userId,
      changes: { name: input.name, status: input.status },
    });
  }
}

@Injectable()
export class CreateHrDesignationUseCase {
  constructor(private readonly people: PeopleRepository) {}

  async execute(actor: Actor, input: NewDesignation): Promise<HrDesignationRecord> {
    if (!(await this.people.activeDepartmentExists(input.departmentId))) {
      throw new ValidationError('Choose an active department', 'UNKNOWN_REFERENCE');
    }
    return this.people.createDesignation(input, {
      action: 'hr.designation.create',
      userId: actor.userId,
      changes: { name: input.name, departmentId: input.departmentId, status: input.status },
    });
  }
}

/** What a person points at, as the checks need it. */
interface PersonLinks {
  departmentId: string | null;
  designationId: string | null;
  reportingManagerId: string | null;
}

/**
 * Checks the department, designation and reporting manager of a new or edited person and returns
 * the department the person ends up in (it follows the designation). A link the record already
 * has is accepted even if it has been deactivated since; a NEW link must be active.
 */
async function resolveLinks(
  people: PeopleRepository,
  input: NewPerson,
  current: PersonLinks | null,
): Promise<string | null> {
  let departmentId = input.departmentId;
  if (input.designationId) {
    const designation = await people.activeDesignationDepartment(input.designationId);
    if (!designation) {
      if (input.designationId !== current?.designationId) {
        throw new ValidationError('Choose an active designation', 'UNKNOWN_REFERENCE');
      }
    } else {
      // A designation belongs to one department: the person's department follows it.
      if (departmentId && departmentId !== designation.departmentId) {
        throw new ValidationError(
          'The designation does not belong to the chosen department',
          'DESIGNATION_DEPARTMENT_MISMATCH',
        );
      }
      departmentId = designation.departmentId;
    }
  }
  if (
    departmentId &&
    departmentId !== current?.departmentId &&
    !(await people.activeDepartmentExists(departmentId))
  ) {
    throw new ValidationError('Choose an active department', 'UNKNOWN_REFERENCE');
  }
  if (
    input.reportingManagerId &&
    input.reportingManagerId !== current?.reportingManagerId &&
    !(await people.activeEmployeeExists(input.reportingManagerId))
  ) {
    throw new ValidationError(
      'Choose an active employee as reporting manager',
      'UNKNOWN_REFERENCE',
    );
  }
  return departmentId;
}

/** Names and references only: never bank, address or document details. */
const auditChanges = (input: NewPerson, departmentId: string | null) => ({
  firstName: input.firstName,
  lastName: input.lastName,
  departmentId,
  designationId: input.designationId,
  reportingManagerId: input.reportingManagerId,
  status: input.status,
});

@Injectable()
export class CreateHrPersonUseCase {
  constructor(private readonly people: PeopleRepository) {}

  async execute(actor: Actor, kind: PersonKind, input: NewPerson): Promise<HrPersonDetail> {
    const departmentId = await resolveLinks(this.people, input, null);
    return this.people.createPerson(
      kind,
      { ...input, departmentId },
      {
        action: kind === 'employee' ? 'hr.employee.create' : 'hr.article.create',
        userId: actor.userId,
        changes: auditChanges(input, departmentId),
      },
    );
  }
}

/** Edits an employee or article. The code never changes; documents have their own endpoints. */
@Injectable()
export class UpdateHrPersonUseCase {
  constructor(private readonly people: PeopleRepository) {}

  async execute(
    actor: Actor,
    kind: PersonKind,
    id: string,
    input: NewPerson,
  ): Promise<HrPersonDetail> {
    const current = await this.people.findPerson(kind, id);
    if (!current) throw new NotFoundError('Record not found');
    if (kind === 'employee' && input.reportingManagerId === id) {
      throw new ValidationError('An employee cannot report to themselves', 'REPORTING_CYCLE');
    }
    const departmentId = await resolveLinks(this.people, input, current);
    return this.people.updatePerson(
      kind,
      id,
      { ...input, departmentId },
      {
        action: kind === 'employee' ? 'hr.employee.update' : 'hr.article.update',
        userId: actor.userId,
        changes: auditChanges(input, departmentId),
      },
    );
  }
}

/**
 * DEVELOPMENT ONLY: deletes an employee or article for good (row, extra-document rows and files).
 * Refused in production, where people are deactivated instead; replace with a proper rule later.
 */
@Injectable()
export class DeleteHrPersonUseCase {
  constructor(
    private readonly people: PeopleRepository,
    private readonly storage: FileStorage,
    private readonly config: AppConfig,
  ) {}

  async execute(actor: Actor, kind: PersonKind, id: string): Promise<void> {
    if (this.config.isProduction) {
      throw new ForbiddenError('Deleting is disabled in production');
    }
    const keys = await this.people.hardDeletePerson(kind, id, {
      action: kind === 'employee' ? 'hr.employee.delete' : 'hr.article.delete',
      userId: actor.userId,
      changes: { development: true },
    });
    // The row is gone; a file that cannot be removed is only leftover disk space.
    await Promise.all(keys.map((key) => this.storage.remove(key).catch(() => undefined)));
  }
}

/** Resume may also be a Word file; ID proof and passbook copy are a PDF or an image. */
const ALLOWED: Record<PersonDocumentKind, readonly UploadMime[]> = {
  'id-proof': ['application/pdf', 'image/jpeg', 'image/png'],
  passbook: ['application/pdf', 'image/jpeg', 'image/png'],
  resume: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
};

/** A readable original name: no path, no control characters, at most 150 characters. */
function cleanFileName(raw: string | undefined, fallback: string): string {
  const base = (raw ?? '').split(/[\\/]/).pop() ?? '';
  const name = Array.from(base)
    .filter((c) => c.charCodeAt(0) > 31 && c.charCodeAt(0) !== 127)
    .join('')
    .trim()
    .slice(0, 150);
  return name || fallback;
}

@Injectable()
export class UploadHrDocumentUseCase {
  constructor(
    private readonly people: PeopleRepository,
    private readonly storage: FileStorage,
    private readonly tenant: TenantContext,
  ) {}

  async execute(
    actor: Actor,
    kind: PersonKind,
    id: string,
    document: PersonDocumentKind,
    fileName: string | undefined,
    data: unknown,
  ): Promise<{ fileName: string; mime: string }> {
    const mime = validateUpload(data, ALLOWED[document]);
    if (!(await this.people.findPerson(kind, id))) throw new NotFoundError('Record not found');

    // The key is made here, from the tenant and a random id: nothing from the request.
    const key = `${this.tenant.getTenantId()}/hr/${kind}/${randomUUID()}.${extensionOf(mime)}`;
    const file: PersonDocumentFile = {
      key,
      fileName: cleanFileName(fileName, `${document}.${extensionOf(mime)}`),
      mime,
    };
    await this.storage.put(key, data as Buffer);
    try {
      const { previousKey } = await this.people.setDocument(kind, id, document, file, {
        action: `hr.${kind}.document.upload`,
        userId: actor.userId,
        changes: {},
      });
      if (previousKey) await this.storage.remove(previousKey);
    } catch (error) {
      await this.storage.remove(key);
      throw error;
    }
    return { fileName: file.fileName, mime };
  }
}

@Injectable()
export class GetHrDocumentUseCase {
  constructor(
    private readonly people: PeopleRepository,
    private readonly storage: FileStorage,
  ) {}

  async execute(
    kind: PersonKind,
    id: string,
    document: PersonDocumentKind,
  ): Promise<{ fileName: string; mime: string; data: Buffer }> {
    const file = await this.people.findDocument(kind, id, document);
    const data = file ? await this.storage.get(file.key) : null;
    if (!file || !data) throw new NotFoundError('No file uploaded');
    return { fileName: file.fileName, mime: file.mime, data };
  }
}

/** Additional documents: a PDF, an image or a Word file, any number per person (up to 20). */
const ADDITIONAL_ALLOWED: readonly UploadMime[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_ADDITIONAL_DOCUMENTS = 20;

@Injectable()
export class UploadHrAdditionalDocumentUseCase {
  constructor(
    private readonly people: PeopleRepository,
    private readonly storage: FileStorage,
    private readonly tenant: TenantContext,
  ) {}

  async execute(
    actor: Actor,
    kind: PersonKind,
    id: string,
    title: string | undefined,
    fileName: string | undefined,
    data: unknown,
  ): Promise<AdditionalDocumentInfo> {
    const mime = validateUpload(data, ADDITIONAL_ALLOWED);
    if (!(await this.people.findPerson(kind, id))) throw new NotFoundError('Record not found');
    if ((await this.people.countAdditionalDocuments(kind, id)) >= MAX_ADDITIONAL_DOCUMENTS) {
      throw new ValidationError(
        `At most ${MAX_ADDITIONAL_DOCUMENTS} additional documents per record`,
        'TOO_MANY_DOCUMENTS',
      );
    }
    const key = `${this.tenant.getTenantId()}/hr/${kind}/${randomUUID()}.${extensionOf(mime)}`;
    const name = cleanFileName(fileName, `document.${extensionOf(mime)}`);
    await this.storage.put(key, data as Buffer);
    try {
      return await this.people.addAdditionalDocument(
        kind,
        id,
        { key, fileName: name, mime, title: cleanFileName(title, '').slice(0, 100) },
        { action: `hr.${kind}.additional_document.upload`, userId: actor.userId, changes: {} },
      );
    } catch (error) {
      await this.storage.remove(key);
      throw error;
    }
  }
}

@Injectable()
export class GetHrAdditionalDocumentUseCase {
  constructor(
    private readonly people: PeopleRepository,
    private readonly storage: FileStorage,
  ) {}

  async execute(
    kind: PersonKind,
    id: string,
    documentId: string,
  ): Promise<{ fileName: string; mime: string; data: Buffer }> {
    const file = await this.people.findAdditionalDocument(kind, id, documentId);
    const data = file ? await this.storage.get(file.key) : null;
    if (!file || !data) throw new NotFoundError('No such file');
    return { fileName: file.fileName, mime: file.mime, data };
  }
}
