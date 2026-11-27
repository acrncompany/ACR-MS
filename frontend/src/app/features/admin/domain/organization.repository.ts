import { Observable } from 'rxjs';
import { Department, Position, Role } from './admin.models';

export interface DepartmentInput {
  name: string;
  parentId: string | null;
}

export interface PositionInput {
  title: string;
  designationCode: string | null;
  departmentId: string;
  parentId: string | null;
  roleId: string;
}

/**
 * Departments, positions and roles. The server prevents cycles (a node cannot become its own
 * descendant) and keeps codes unique; errors come back with a readable message. Codes are
 * permanent: they are only sent when creating. There is no delete here.
 */
export abstract class OrganizationRepository {
  abstract departments(): Observable<Department[]>;
  abstract positions(): Observable<Position[]>;
  /** Read-only for now (role editing is on the backlog). */
  abstract roles(): Observable<Role[]>;
  abstract addDepartment(input: DepartmentInput & { code: string }): Observable<Department>;
  abstract updateDepartment(id: string, input: DepartmentInput): Observable<Department>;
  abstract addPosition(input: PositionInput & { code: string }): Observable<Position>;
  abstract updatePosition(id: string, input: PositionInput): Observable<Position>;
}
