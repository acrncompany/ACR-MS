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

export interface HrEmployeeRecord {
  id: string;
  /** HRE-0001... Permanent, issued once, never reused. */
  code: string;
  name: string;
  email: string;
  phone: string;
  departmentId: string | null;
  departmentName: string | null;
  designationId: string | null;
  designationName: string | null;
  /** ISO date (YYYY-MM-DD). */
  joinDate: string;
  status: DirectoryStatus;
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

export interface NewEmployee {
  name: string;
  email: string;
  phone: string;
  departmentId: string | null;
  designationId: string | null;
  joinDate: string;
  status: DirectoryStatus;
}
