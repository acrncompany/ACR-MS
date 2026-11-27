import { Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '../../../core/errors/app-error.js';
import type { Actor } from '../../access/domain/actor.js';
import { wouldCreateCycle } from './org-tree.js';
import { OrganizationRepository } from './organization.repository.js';
import { DepartmentRecord, PositionRecord } from './organization.records.js';

@Injectable()
export class ListDepartmentsUseCase {
  constructor(private readonly org: OrganizationRepository) {}

  execute(): Promise<DepartmentRecord[]> {
    return this.org.listDepartments();
  }
}

@Injectable()
export class ListPositionsUseCase {
  constructor(private readonly org: OrganizationRepository) {}

  execute(): Promise<PositionRecord[]> {
    return this.org.listPositions();
  }
}

@Injectable()
export class FindPositionUseCase {
  constructor(private readonly org: OrganizationRepository) {}

  execute(id: string): Promise<PositionRecord | null> {
    return this.org.findPosition(id);
  }
}

export interface DepartmentInput {
  name: string;
  parentId: string | null;
}

@Injectable()
export class CreateDepartmentUseCase {
  constructor(private readonly org: OrganizationRepository) {}

  async execute(
    actor: Actor,
    input: DepartmentInput & { code: string },
  ): Promise<DepartmentRecord> {
    if (input.parentId && !(await this.org.findDepartment(input.parentId))) {
      throw new ValidationError('The parent department does not exist', 'UNKNOWN_REFERENCE');
    }
    return this.org.createDepartment(input, {
      action: 'department.create',
      userId: actor.userId,
      changes: { ...input },
    });
  }
}

/** The department code is permanent: only the name and the parent can change. */
@Injectable()
export class UpdateDepartmentUseCase {
  constructor(private readonly org: OrganizationRepository) {}

  async execute(actor: Actor, id: string, input: DepartmentInput): Promise<DepartmentRecord> {
    const current = await this.org.findDepartment(id);
    if (!current) throw new NotFoundError('Department not found');
    if (input.parentId) {
      const all = await this.org.listDepartments();
      if (!all.some((d) => d.id === input.parentId)) {
        throw new ValidationError('The parent department does not exist', 'UNKNOWN_REFERENCE');
      }
      if (wouldCreateCycle(all, id, input.parentId)) {
        throw new ValidationError(
          'A department cannot report to itself or to one of its own sub-departments',
          'ORG_CYCLE',
        );
      }
    }
    return this.org.updateDepartment(id, input, {
      action: 'department.update',
      userId: actor.userId,
      changes: { before: { name: current.name, parentId: current.parentId }, after: { ...input } },
    });
  }
}

export interface PositionInput {
  name: string;
  designationCode: string | null;
  departmentId: string;
  parentId: string | null;
  roleId: string;
}

@Injectable()
export class CreatePositionUseCase {
  constructor(private readonly org: OrganizationRepository) {}

  async execute(actor: Actor, input: PositionInput & { code: string }): Promise<PositionRecord> {
    await this.checkReferences(input);
    return this.org.createPosition(input, {
      action: 'position.create',
      userId: actor.userId,
      changes: { ...input },
    });
  }

  private async checkReferences(input: PositionInput): Promise<void> {
    if (!(await this.org.findDepartment(input.departmentId))) {
      throw new ValidationError('The department does not exist', 'UNKNOWN_REFERENCE');
    }
    if (input.parentId && !(await this.org.findPosition(input.parentId))) {
      throw new ValidationError('The parent position does not exist', 'UNKNOWN_REFERENCE');
    }
  }
}

/** The position code is permanent. The hierarchy comes only from `parentId`, never from codes. */
@Injectable()
export class UpdatePositionUseCase {
  constructor(private readonly org: OrganizationRepository) {}

  async execute(actor: Actor, id: string, input: PositionInput): Promise<PositionRecord> {
    const current = await this.org.findPosition(id);
    if (!current) throw new NotFoundError('Position not found');
    if (!(await this.org.findDepartment(input.departmentId))) {
      throw new ValidationError('The department does not exist', 'UNKNOWN_REFERENCE');
    }
    if (input.parentId) {
      const all = await this.org.listPositions();
      if (!all.some((p) => p.id === input.parentId)) {
        throw new ValidationError('The parent position does not exist', 'UNKNOWN_REFERENCE');
      }
      if (wouldCreateCycle(all, id, input.parentId)) {
        throw new ValidationError(
          'A position cannot report to itself or to one of its own reports',
          'ORG_CYCLE',
        );
      }
    }
    return this.org.updatePosition(id, input, {
      action: 'position.update',
      userId: actor.userId,
      changes: {
        before: {
          name: current.name,
          designationCode: current.designationCode,
          departmentId: current.departmentId,
          parentId: current.parentId,
          roleId: current.roleId,
        },
        after: { ...input },
      },
    });
  }
}
