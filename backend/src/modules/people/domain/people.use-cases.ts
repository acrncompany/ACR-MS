import { Injectable } from '@nestjs/common';
import { ValidationError } from '../../../core/errors/app-error.js';
import type { Actor } from '../../access/domain/actor.js';
import { PeopleRepository } from './people.repository.js';
import {
  HrDepartmentRecord,
  HrDesignationRecord,
  HrEmployeeRecord,
  HrOption,
  NewDepartment,
  NewDesignation,
  NewEmployee,
  PeoplePage,
  PeopleQuery,
} from './people.records.js';

@Injectable()
export class ListHrDepartmentsUseCase {
  constructor(private readonly people: PeopleRepository) {}

  execute(query: PeopleQuery): Promise<PeoplePage<HrDepartmentRecord>> {
    return this.people.listDepartments(query);
  }
}

@Injectable()
export class ListHrDesignationsUseCase {
  constructor(private readonly people: PeopleRepository) {}

  execute(query: PeopleQuery): Promise<PeoplePage<HrDesignationRecord>> {
    return this.people.listDesignations(query);
  }
}

@Injectable()
export class ListHrEmployeesUseCase {
  constructor(private readonly people: PeopleRepository) {}

  execute(query: PeopleQuery): Promise<PeoplePage<HrEmployeeRecord>> {
    return this.people.listEmployees(query);
  }
}

@Injectable()
export class ListHrOptionsUseCase {
  constructor(private readonly people: PeopleRepository) {}

  departments(): Promise<HrOption[]> {
    return this.people.departmentOptions();
  }

  designations(): Promise<HrOption[]> {
    return this.people.designationOptions();
  }
}

/** Previews for the "add" forms. The real code is issued when the row is saved. */
@Injectable()
export class PeekHrCodeUseCase {
  constructor(private readonly people: PeopleRepository) {}

  async execute(kind: 'department' | 'designation' | 'employee'): Promise<{ code: string }> {
    const code =
      kind === 'department'
        ? await this.people.peekDepartmentCode()
        : kind === 'designation'
          ? await this.people.peekDesignationCode()
          : await this.people.peekEmployeeCode();
    return { code };
  }
}

@Injectable()
export class CreateHrDepartmentUseCase {
  constructor(private readonly people: PeopleRepository) {}

  execute(actor: Actor, input: NewDepartment): Promise<HrDepartmentRecord> {
    return this.people.createDepartment(input, {
      action: 'hr.department.create',
      userId: actor.userId,
      changes: { name: input.name, status: input.status },
    });
  }
}

@Injectable()
export class CreateHrDesignationUseCase {
  constructor(private readonly people: PeopleRepository) {}

  async execute(actor: Actor, input: NewDesignation): Promise<HrDesignationRecord> {
    if (!(await this.people.activeDepartmentExists(input.departmentId))) {
      throw new ValidationError('Choose an active department', 'UNKNOWN_REFERENCE');
    }
    return this.people.createDesignation(input, {
      action: 'hr.designation.create',
      userId: actor.userId,
      changes: { name: input.name, departmentId: input.departmentId, status: input.status },
    });
  }
}

@Injectable()
export class CreateHrEmployeeUseCase {
  constructor(private readonly people: PeopleRepository) {}

  async execute(actor: Actor, input: NewEmployee): Promise<HrEmployeeRecord> {
    let departmentId = input.departmentId;
    if (input.designationId) {
      const designation = await this.people.activeDesignationDepartment(input.designationId);
      if (!designation) {
        throw new ValidationError('Choose an active designation', 'UNKNOWN_REFERENCE');
      }
      // A designation belongs to one department: the employee's department follows it.
      if (departmentId && departmentId !== designation.departmentId) {
        throw new ValidationError(
          'The designation does not belong to the chosen department',
          'DESIGNATION_DEPARTMENT_MISMATCH',
        );
      }
      departmentId = designation.departmentId;
    }
    if (departmentId && !(await this.people.activeDepartmentExists(departmentId))) {
      throw new ValidationError('Choose an active department', 'UNKNOWN_REFERENCE');
    }
    return this.people.createEmployee(
      { ...input, departmentId },
      {
        action: 'hr.employee.create',
        userId: actor.userId,
        changes: {
          name: input.name,
          departmentId,
          designationId: input.designationId,
          status: input.status,
        },
      },
    );
  }
}
