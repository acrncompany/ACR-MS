import { Observable } from 'rxjs';
import { Page, PageQuery } from '../../../core/http/page';
import {
  DepartmentEntry,
  DepartmentInput,
  DesignationEntry,
  DesignationInput,
  DirectoryKind,
  DirectoryOption,
  AdditionalDocument,
  DocumentInfo,
  DocumentKind,
  PersonDetail,
  PersonEntry,
  PersonInput,
  PersonKind,
} from './people-directory.models';

/** The People directory (departments, designations, employees, articles). Backend only: no mock. */
export abstract class PeopleDirectoryRepository {
  /** Search (code, name...) and paging happen on the server. */
  abstract departments(query: PageQuery): Observable<Page<DepartmentEntry>>;
  abstract designations(query: PageQuery): Observable<Page<DesignationEntry>>;
  abstract people(kind: PersonKind, query: PageQuery): Observable<Page<PersonEntry>>;
  abstract person(kind: PersonKind, id: string): Observable<PersonDetail>;

  /** Active entries for dropdowns. */
  abstract departmentOptions(): Observable<DirectoryOption[]>;
  abstract designationOptions(): Observable<DirectoryOption[]>;
  /** Active employees: the possible reporting managers (for employees and articles). */
  abstract employeeOptions(): Observable<DirectoryOption[]>;

  /** Preview of the code the next create will get (not reserved: the server issues it on save). */
  abstract nextCode(kind: DirectoryKind): Observable<string>;

  /** The server issues the code in the same transaction as the insert. */
  abstract createDepartment(input: DepartmentInput): Observable<DepartmentEntry>;
  abstract createDesignation(input: DesignationInput): Observable<DesignationEntry>;
  abstract createPerson(kind: PersonKind, input: PersonInput): Observable<PersonDetail>;

  /** Replaces the editable fields of a record (the code never changes). */
  abstract updatePerson(kind: PersonKind, id: string, input: PersonInput): Observable<PersonDetail>;

  /** DEVELOPMENT ONLY: deletes the record for good (the server refuses it in production). */
  abstract deletePerson(kind: PersonKind, id: string): Observable<void>;

  /** Uploads (or replaces) a document: at most 2 MB, checked again by the server. */
  abstract uploadDocument(
    kind: PersonKind,
    id: string,
    document: DocumentKind,
    file: File,
  ): Observable<DocumentInfo>;
  /** The stored file, to open in a new tab. */
  abstract document(kind: PersonKind, id: string, document: DocumentKind): Observable<Blob>;

  /** Adds one additional document (at most 2 MB). The name is optional. */
  abstract uploadAdditionalDocument(
    kind: PersonKind,
    id: string,
    file: File,
    title: string,
  ): Observable<AdditionalDocument>;
  abstract additionalDocument(kind: PersonKind, id: string, documentId: string): Observable<Blob>;
}
