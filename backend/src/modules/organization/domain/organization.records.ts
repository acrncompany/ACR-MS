export interface DepartmentRecord {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
}

export interface PositionRecord {
  id: string;
  /** Names the ROLE (e.g. FIN_OFFICER): permanent, unique per tenant, no level numbers. */
  code: string;
  name: string;
  /** The CEO's short label (TM, TL, ...). Display only; never used for the hierarchy. */
  designationCode: string | null;
  departmentId: string;
  /** The reporting line: the position this one reports to. */
  parentId: string | null;
  roleId: string | null;
  seesAll: boolean;
  allBranches: boolean;
}

/** What a mutation writes to audit_logs, in the same transaction as the change itself. */
export interface AuditSpec {
  action: string;
  userId: string;
  changes: Record<string, unknown>;
}
