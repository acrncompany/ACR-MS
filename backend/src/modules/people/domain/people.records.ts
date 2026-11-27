export type DirectoryStatus = 'Active' | 'Inactive';

export interface HrDepartmentRecord {
  id: string;
  /** DEP-0001... Permanent, issued once, never reused. */
  code: string;
  name: string;
  description: string;
  status: DirectoryStatus;
}

export interface HrDesignationRecord {
  id: string;
  /** DSG-0001... Permanent, issued once, never reused. */
  code: string;
  name: string;
  departmentId: string;
  departmentName: string;
  description: string;
  status: DirectoryStatus;
}

/** Employees and articles share one profile; they differ only in code series and table. */
export type PersonKind = 'employee' | 'article';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';
export type IdProofType = 'AADHAAR' | 'PAN' | 'PASSPORT' | 'VOTER_ID' | 'DRIVING_LICENCE';

/** The three uploadable documents of a person. */
export type PersonDocumentKind = 'id-proof' | 'resume' | 'passbook';

export interface PersonAddress {
  houseName: string;
  postOffice: string;
  district: string;
  pinCode: string;
  state: string;
}

export interface PersonEmergencyContact {
  name: string;
  relation: string;
  mobNo: string;
}

export interface PersonBank {
  accountHolder: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
}

/** An uploaded file as shown to clients: never the storage key. */
export interface PersonDocumentInfo {
  fileName: string;
  mime: string;
}

/** A row of the Employees / Articles list. */
export interface HrPersonRecord {
  id: string;
  /** ACR-0001: tenant prefix + number, one series for employees and articles. Permanent, never reused. */
  code: string;
  firstName: string;
  /** May be empty. */
  lastName: string;
  /** First and last name together (derived, for lists and dropdowns). */
  name: string;
  email: string;
  mobNo: string;
  departmentId: string | null;
  departmentName: string | null;
  designationId: string | null;
  designationName: string | null;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
  /** ISO date (YYYY-MM-DD). */
  joinDate: string;
  status: DirectoryStatus;
}

/** The full profile (detail page and create response). */
export interface HrPersonDetail extends HrPersonRecord {
  dateOfBirth: string | null;
  gender: Gender | null;
  maritalStatus: MaritalStatus | null;
  address: PersonAddress;
  emergencyContact: PersonEmergencyContact;
  idProofType: IdProofType | null;
  bank: PersonBank;
  documents: {
    idProof: PersonDocumentInfo | null;
    resume: PersonDocumentInfo | null;
    passbook: PersonDocumentInfo | null;
  };
  /** Any number of extra documents, oldest first. */
  additionalDocuments: AdditionalDocumentInfo[];
}

/** One of a person's additional documents as shown to clients (never the storage key). */
export interface AdditionalDocumentInfo extends PersonDocumentInfo {
  id: string;
  title: string;
}

/** A new additional document: the file is already stored under `key`. */
export interface NewAdditionalDocument extends PersonDocumentFile {
  title: string;
}

/** A stored document ready to be served. */
export interface PersonDocumentFile extends PersonDocumentInfo {
  key: string;
}

/** Active entries for a dropdown (no paging). */
export interface HrOption {
  id: string;
  name: string;
  /** Designations only: the department they belong to. */
  departmentId?: string;
}

export interface PeopleQuery {
  q: string | null;
  page: number;
  pageSize: number;
}

export interface PeoplePage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PeopleAuditSpec {
  action: string;
  userId: string;
  changes: Record<string, unknown>;
}

export interface NewDepartment {
  name: string;
  description: string;
  status: DirectoryStatus;
}

export interface NewDesignation extends NewDepartment {
  departmentId: string;
}

export interface NewPerson {
  firstName: string;
  lastName: string;
  email: string;
  mobNo: string;
  departmentId: string | null;
  designationId: string | null;
  reportingManagerId: string | null;
  /** ISO date (YYYY-MM-DD). */
  joinDate: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  maritalStatus: MaritalStatus | null;
  address: PersonAddress;
  emergencyContact: PersonEmergencyContact;
  idProofType: IdProofType | null;
  bank: PersonBank;
  status: DirectoryStatus;
}
