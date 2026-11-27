export interface StaffRecord {
  id: string;
  /** EMP-0001... Permanent, issued once, never reused. */
  employeeCode: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  /** ISO date YYYY-MM-DD. */
  dateOfBirth: string | null;
  dateOfJoining: string | null;
  positionId: string | null;
  positionName: string | null;
  positionCode: string | null;
  /** The CEO's display label (TM, TL, ...). Never used for the hierarchy. */
  designationCode: string | null;
  departmentId: string | null;
  departmentName: string | null;
  roleName: string | null;
  managerId: string | null;
  managerName: string | null;
  managerCode: string | null;
  active: boolean;
  mustChangePassword: boolean;
}

/** A row of the list: the record plus what the CALLER may do with it (decided by the server). */
export interface StaffListItem extends StaffRecord {
  canManage: boolean;
}

export interface StaffQuery {
  q: string | null;
  active: boolean | null;
  /** null = everyone (Board, GM); otherwise the caller and their subtree. */
  scopeIds: string[] | null;
  page: number;
  pageSize: number;
}

export interface StaffPage {
  items: StaffRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface NewStaff {
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  dateOfBirth: string | null;
  dateOfJoining: string | null;
  positionId: string;
  managerId: string | null;
  passwordHash: string;
  /** The role of the position, granted to the new user. */
  roleId: string | null;
  homeBranchId: string | null;
  /** Branches the user may use (empty for all-branches positions). */
  branchAccessIds: string[];
}

export interface StaffChanges {
  name?: string;
  email?: string;
  phone?: string | null;
  address?: string | null;
  dateOfBirth?: string | null;
  dateOfJoining?: string | null;
  positionId?: string;
  managerId?: string | null;
  /** When the position changes: the new position's role (replaces the user's role). */
  roleId?: string | null;
}

export interface StaffAuditSpec {
  action: string;
  userId: string;
  changes: Record<string, unknown>;
}
