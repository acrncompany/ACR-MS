export type DirectoryStatus = 'Active' | 'Inactive';

/**
 * HR directory lists (HR > Employees). Independent of the organisation hierarchy. Codes
 * (DEP-0001, DSG-0001, HRE-0001) are issued by the server: never an input, never changed.
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

export interface EmployeeEntry {
  id: string;
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
export type EmployeeInput = Omit<
  EmployeeEntry,
  'id' | 'code' | 'departmentName' | 'designationName'
>;

/** An active department or designation for a dropdown (designations carry their department). */
export interface DirectoryOption {
  id: string;
  name: string;
  departmentId?: string;
}

export type DirectoryKind = 'department' | 'designation' | 'employee';
