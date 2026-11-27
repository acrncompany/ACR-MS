export type {
  Action,
  ExtraAction,
  ModuleDef,
  ModuleExtraActionDef,
  StandardAction,
  WorksheetAction,
  WorksheetActionDef,
} from './permission-matrix';
export { ACTIONS, MODULES, MODULE_EXTRA_ACTIONS, WORKSHEET_ACTIONS } from './permission-matrix';

/**
 * A department is a grouping label. `code` (OPS, FIN) is its permanent code, unique per tenant,
 * letters and "_" / "-" only (no level numbers). The reporting lines live on positions.
 */
export interface Department {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
}

/** A position sits in a department, reports to another position and carries a role. */
export interface Position {
  id: string;
  title: string;
  departmentId: string;
  /** The reporting line: the position this one reports to. */
  parentId: string | null;
  roleId: string | null;
  /** Permanent code of the ROLE (e.g. FIN_OFFICER), unique per tenant, no level numbers. */
  code: string;
  /**
   * The CEO's short label (TM, TL, TD, AD, GM, P1). DISPLAY ONLY: the hierarchy comes from
   * `parentId` (position) and `managerId` (person), never from this code. Null until confirmed.
   */
  designationCode: string | null;
  /** Sees every record (Board, GM). Set by the system, not editable here. */
  seesAll: boolean;
}

/** A role is a set of permission keys ("clients.view"). Role editing is on the backlog. */
export interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  permissions: string[];
}

/** A staff member as the API returns them. The server decides who may see and manage whom. */
export interface StaffMember {
  id: string;
  /** EMP-0001... Issued once by the server, never changed, never reused. */
  employeeCode: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  /** ISO date (YYYY-MM-DD). */
  dateOfBirth: string | null;
  dateOfJoining: string | null;
  positionId: string | null;
  positionName: string | null;
  positionCode: string | null;
  designationCode: string | null;
  departmentId: string | null;
  departmentName: string | null;
  roleName: string | null;
  managerId: string | null;
  managerName: string | null;
  managerCode: string | null;
  /** The existing active/inactive flag (no second status field). */
  active: boolean;
  mustChangePassword: boolean;
  /** Whether the signed-in user may edit, deactivate or delete this person (decided by the server). */
  canManage?: boolean;
}

/** What the create/edit form sends. The employee code is issued by the server, never sent. */
export interface StaffInput {
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  dateOfBirth: string | null;
  dateOfJoining: string | null;
  positionId: string;
  managerId: string | null;
}

export interface NewStaffInput extends StaffInput {
  /** An admin-chosen password, or generate a temporary one (shown once). */
  password?: string;
  generateTemporaryPassword?: boolean;
}

/** An active person for assignment and manager dropdowns. */
export interface AssignableStaff {
  id: string;
  name: string;
  employeeCode: string;
  positionId: string | null;
  positionName: string | null;
}
