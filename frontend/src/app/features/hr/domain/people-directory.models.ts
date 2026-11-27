export type DirectoryStatus = 'Active' | 'Inactive';

/**
 * People lists (HR > People). Independent of the organisation hierarchy. Codes (DEP-0001,
 * DSG-0001, and ACR-0001 for employees and articles, one shared series) are issued by the server: never an input, never changed.
 */
export interface DepartmentEntry {
  id: string;
  code: string;
  name: string;
  description: string;
  status: DirectoryStatus;
}
export type DepartmentInput = Omit<DepartmentEntry, 'id' | 'code'>;

export interface DesignationEntry {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  departmentName: string;
  description: string;
  status: DirectoryStatus;
}
export type DesignationInput = Omit<DesignationEntry, 'id' | 'code' | 'departmentName'>;

/** Employees and articles share one profile; only the code series differs. */
export type PersonKind = 'employee' | 'article';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';
export type IdProofType = 'AADHAAR' | 'PAN' | 'PASSPORT' | 'VOTER_ID' | 'DRIVING_LICENCE';

/** The three uploadable documents. */
export type DocumentKind = 'id-proof' | 'resume' | 'passbook';

/** Largest accepted upload (the server enforces it too). */
export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;

/** A row of the Employees / Articles list. */
export interface PersonEntry {
  id: string;
  code: string;
  firstName: string;
  /** May be empty. */
  lastName: string;
  /** First and last name together (derived by the server, for lists and dropdowns). */
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

/** An uploaded file as the server describes it (the storage key is never exposed). */
export interface DocumentInfo {
  fileName: string;
  mime: string;
}

/** An additional document the record already has (the storage key is never exposed). */
export interface AdditionalDocument extends DocumentInfo {
  id: string;
  /** What the user called it; may be empty (then the file name is shown). */
  title: string;
}

/** An additional document chosen on the form, uploaded after the record is saved. */
export interface PendingDocument {
  file: File;
  title: string;
}

export interface PersonDetail extends PersonEntry {
  /** ISO date (YYYY-MM-DD). */
  dateOfBirth: string | null;
  gender: Gender | null;
  maritalStatus: MaritalStatus | null;
  address: PersonAddress;
  emergencyContact: PersonEmergencyContact;
  idProofType: IdProofType | null;
  bank: PersonBank;
  documents: {
    idProof: DocumentInfo | null;
    resume: DocumentInfo | null;
    passbook: DocumentInfo | null;
  };
  additionalDocuments: AdditionalDocument[];
}

export type PersonInput = Omit<
  PersonDetail,
  | 'id'
  | 'name'
  | 'code'
  | 'departmentName'
  | 'designationName'
  | 'reportingManagerName'
  | 'documents'
  | 'additionalDocuments'
>;

/** An active department, designation or employee for a dropdown (designations carry their department). */
export interface DirectoryOption {
  id: string;
  name: string;
  departmentId?: string;
}

export type DirectoryKind = 'department' | 'designation' | PersonKind;

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
};

export const MARITAL_LABELS: Record<MaritalStatus, string> = {
  SINGLE: 'Single',
  MARRIED: 'Married',
  DIVORCED: 'Divorced',
  WIDOWED: 'Widowed',
};

export const ID_PROOF_LABELS: Record<IdProofType, string> = {
  AADHAAR: 'Aadhaar',
  PAN: 'PAN card',
  PASSPORT: 'Passport',
  VOTER_ID: 'Voter ID',
  DRIVING_LICENCE: 'Driving licence',
};

export const PERSON_LABELS: Record<PersonKind, { singular: string; plural: string }> = {
  employee: { singular: 'employee', plural: 'Employees' },
  article: { singular: 'article', plural: 'Articles' },
};
