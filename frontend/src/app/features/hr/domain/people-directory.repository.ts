import { Observable } from 'rxjs';
import { Page, PageQuery } from '../../../core/http/page';
import {
  DepartmentEntry,
  DepartmentInput,
  DesignationEntry,
  DesignationInput,
  DirectoryKind,
  DirectoryOption,
  EmployeeEntry,
  EmployeeInput,
} from './people-directory.models';

/** The HR directory (departments, designations, employees). Backend only: there is no mock. */
export abstract class PeopleDirectoryRepository {
  /** Search (code, name...) and paging happen on the server. */
  abstract departments(query: PageQuery): Observable<Page<DepartmentEntry>>;
  abstract designations(query: PageQuery): Observable<Page<DesignationEntry>>;
  abstract employees(query: PageQuery): Observable<Page<EmployeeEntry>>;

  /** Active entries for dropdowns. */
  abstract departmentOptions(): Observable<DirectoryOption[]>;
  abstract designationOptions(): Observable<DirectoryOption[]>;

  /** Preview of the code the next create will get (not reserved: the server issues it on save). */
  abstract nextCode(kind: DirectoryKind): Observable<string>;

  /** The server issues the code in the same transaction as the insert. */
  abstract createDepartment(input: DepartmentInput): Observable<DepartmentEntry>;
  abstract createDesignation(input: DesignationInput): Observable<DesignationEntry>;
  abstract createEmployee(input: EmployeeInput): Observable<EmployeeEntry>;
}
