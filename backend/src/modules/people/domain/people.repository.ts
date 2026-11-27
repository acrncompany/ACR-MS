import {
  AdditionalDocumentInfo,
  HrDepartmentRecord,
  HrDesignationRecord,
  HrOption,
  HrPersonDetail,
  HrPersonRecord,
  NewAdditionalDocument,
  NewDepartment,
  NewDesignation,
  NewPerson,
  PeopleAuditSpec,
  PeoplePage,
  PeopleQuery,
  PersonDocumentFile,
  PersonDocumentKind,
  PersonKind,
} from './people.records.js';

export abstract class PeopleRepository {
  abstract listDepartments(query: PeopleQuery): Promise<PeoplePage<HrDepartmentRecord>>;
  abstract listDesignations(query: PeopleQuery): Promise<PeoplePage<HrDesignationRecord>>;
  abstract listPeople(kind: PersonKind, query: PeopleQuery): Promise<PeoplePage<HrPersonRecord>>;
  /** The full profile, or null when there is no such person. */
  abstract findPerson(kind: PersonKind, id: string): Promise<HrPersonDetail | null>;

  abstract departmentOptions(): Promise<HrOption[]>;
  abstract designationOptions(): Promise<HrOption[]>;
  /** Active employees (the possible reporting managers). */
  abstract employeeOptions(): Promise<HrOption[]>;

  /** Previews of the code the next create will get (reserves nothing). */
  abstract peekDepartmentCode(): Promise<string>;
  abstract peekDesignationCode(): Promise<string>;
  abstract peekPersonCode(kind: PersonKind): Promise<string>;

  /** Reference checks for the use cases: the row must exist, be active and not deleted. */
  abstract activeDepartmentExists(id: string): Promise<boolean>;
  /** The department of an active designation, or null when there is no such designation. */
  abstract activeDesignationDepartment(id: string): Promise<{ departmentId: string } | null>;
  abstract activeEmployeeExists(id: string): Promise<boolean>;

  /** Each create issues the code and inserts the row and the audit row in ONE transaction. */
  abstract createDepartment(
    input: NewDepartment,
    audit: PeopleAuditSpec,
  ): Promise<HrDepartmentRecord>;
  abstract createDesignation(
    input: NewDesignation,
    audit: PeopleAuditSpec,
  ): Promise<HrDesignationRecord>;
  abstract createPerson(
    kind: PersonKind,
    input: NewPerson,
    audit: PeopleAuditSpec,
  ): Promise<HrPersonDetail>;

  /** The stored document (key, name, type), or null when none was uploaded. */
  abstract findDocument(
    kind: PersonKind,
    id: string,
    document: PersonDocumentKind,
  ): Promise<PersonDocumentFile | null>;
  /**
   * Points the document at a new stored file and audits it in ONE transaction. Returns the
   * previous file's key (to delete) or undefined when there was none.
   */
  abstract setDocument(
    kind: PersonKind,
    id: string,
    document: PersonDocumentKind,
    file: PersonDocumentFile,
    audit: PeopleAuditSpec,
  ): Promise<{ previousKey: string | null }>;

  /** Replaces the editable fields (never the code) and audits it in ONE transaction. */
  abstract updatePerson(
    kind: PersonKind,
    id: string,
    input: NewPerson,
    audit: PeopleAuditSpec,
  ): Promise<HrPersonDetail>;

  /**
   * DEVELOPMENT ONLY: removes the row and its additional-document rows for good, and writes the
   * audit row in the SAME transaction. Refuses (409) an employee who is somebody's reporting
   * manager. Returns the storage keys of every file the record had, for the caller to delete.
   */
  abstract hardDeletePerson(
    kind: PersonKind,
    id: string,
    audit: PeopleAuditSpec,
  ): Promise<string[]>;

  /** Number of additional documents a person has. */
  abstract countAdditionalDocuments(kind: PersonKind, id: string): Promise<number>;
  /** Adds an additional document and audits it in ONE transaction. */
  abstract addAdditionalDocument(
    kind: PersonKind,
    id: string,
    document: NewAdditionalDocument,
    audit: PeopleAuditSpec,
  ): Promise<AdditionalDocumentInfo>;
  abstract findAdditionalDocument(
    kind: PersonKind,
    id: string,
    documentId: string,
  ): Promise<PersonDocumentFile | null>;
}
