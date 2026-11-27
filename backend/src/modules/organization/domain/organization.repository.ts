import { AuditSpec, DepartmentRecord, PositionRecord } from './organization.records.js';

export interface UserOrgContext {
  position: {
    id: string;
    code: string;
    name: string;
    seesAll: boolean;
    allBranches: boolean;
  } | null;
  department: { id: string; code: string; name: string } | null;
  /** Branches the user may work in. */
  branches: { id: string; code: string; name: string }[];
  homeBranchId: string | null;
}

export abstract class OrganizationRepository {
  abstract findUserOrgContext(userId: string, positionId: string | null): Promise<UserOrgContext>;

  abstract listDepartments(): Promise<DepartmentRecord[]>;
  abstract listPositions(): Promise<PositionRecord[]>;
  abstract findDepartment(id: string): Promise<DepartmentRecord | null>;
  abstract findPosition(id: string): Promise<PositionRecord | null>;

  /** Creates the row and its audit entry in one transaction. */
  abstract createDepartment(
    input: { code: string; name: string; parentId: string | null },
    audit: AuditSpec,
  ): Promise<DepartmentRecord>;
  abstract updateDepartment(
    id: string,
    input: { name: string; parentId: string | null },
    audit: AuditSpec,
  ): Promise<DepartmentRecord>;
  abstract createPosition(
    input: {
      code: string;
      name: string;
      designationCode: string | null;
      departmentId: string;
      parentId: string | null;
      roleId: string;
    },
    audit: AuditSpec,
  ): Promise<PositionRecord>;
  abstract updatePosition(
    id: string,
    input: {
      name: string;
      designationCode: string | null;
      departmentId: string;
      parentId: string | null;
      roleId: string;
    },
    audit: AuditSpec,
  ): Promise<PositionRecord>;
}
