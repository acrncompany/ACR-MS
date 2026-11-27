import {
  HrDepartmentRecord,
  HrDesignationRecord,
  HrEmployeeRecord,
  HrOption,
  NewDepartment,
  NewDesignation,
  NewEmployee,
  PeopleAuditSpec,
  PeoplePage,
  PeopleQuery,
} from './people.records.js';

export abstract class PeopleRepository {
  abstract listDepartments(query: PeopleQuery): Promise<PeoplePage<HrDepartmentRecord>>;
  abstract listDesignations(query: PeopleQuery): Promise<PeoplePage<HrDesignationRecord>>;
  abstract listEmployees(query: PeopleQuery): Promise<PeoplePage<HrEmployeeRecord>>;

  abstract departmentOptions(): Promise<HrOption[]>;
  abstract designationOptions(): Promise<HrOption[]>;

  /** Previews of the code the next create will get (reserves nothing). */
  abstract peekDepartmentCode(): Promise<string>;
  abstract peekDesignationCode(): Promise<string>;
  abstract peekEmployeeCode(): Promise<string>;

  /** Reference checks for the use cases: the row must exist, be active and not deleted. */
  abstract activeDepartmentExists(id: string): Promise<boolean>;
  /** The department of an active designation, or null when there is no such designation. */
  abstract activeDesignationDepartment(id: string): Promise<{ departmentId: string } | null>;

  /** Each create issues the code and inserts the row and the audit row in ONE transaction. */
  abstract createDepartment(
    input: NewDepartment,
    audit: PeopleAuditSpec,
  ): Promise<HrDepartmentRecord>;
  abstract createDesignation(
    input: NewDesignation,
    audit: PeopleAuditSpec,
  ): Promise<HrDesignationRecord>;
  abstract createEmployee(input: NewEmployee, audit: PeopleAuditSpec): Promise<HrEmployeeRecord>;
}
