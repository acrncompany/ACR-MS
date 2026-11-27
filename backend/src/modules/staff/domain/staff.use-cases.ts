import { Injectable } from '@nestjs/common';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../core/errors/app-error.js';
import type { Actor } from '../../access/domain/actor.js';
import { CountAuditEntriesByUserUseCase } from '../../audit/domain/record-audit.use-case.js';
import {
  PrepareNewPasswordUseCase,
  RevokeUserSessionsUseCase,
} from '../../auth/domain/password-use-cases.js';
import { CountUserClientFootprintUseCase } from '../../clients/domain/clients.use-cases.js';
import {
  FindPositionUseCase,
  ListPositionsUseCase,
} from '../../organization/domain/organization.use-cases.js';
import { PositionRecord } from '../../organization/domain/organization.records.js';
import { FindActiveUserIdsUseCase } from '../../user/domain/active-users.use-cases.js';
import { NewStaff, StaffChanges, StaffListItem, StaffPage, StaffRecord } from './staff.records.js';
import { StaffRepository } from './staff.repository.js';

/**
 * Who may see and manage whom, decided on the SERVER:
 *  - Board and GM (`seesAll`) see and manage everyone;
 *  - everyone else sees themselves and their subtree (people who report to them, directly or
 *    indirectly) and manages only people BELOW them, never themselves.
 */
@Injectable()
export class StaffScope {
  constructor(private readonly staff: StaffRepository) {}

  /** null = unrestricted. */
  async visibleIds(actor: Actor): Promise<string[] | null> {
    return actor.seesAll ? null : this.staff.subtreeIds(actor.userId);
  }

  async assertVisible(actor: Actor, id: string): Promise<StaffRecord> {
    const user = await this.staff.findById(id);
    const visible = await this.visibleIds(actor);
    if (!user || (visible && !visible.includes(id))) throw new NotFoundError('User not found');
    return user;
  }

  /** The target must be visible AND manageable (below the actor, or any user for Board/GM). */
  async assertManageable(actor: Actor, id: string): Promise<StaffRecord> {
    const user = await this.assertVisible(actor, id);
    if (!actor.seesAll && id === actor.userId) {
      throw new ForbiddenError('You can only manage people who report to you');
    }
    return user;
  }
}

@Injectable()
export class ListStaffUseCase {
  constructor(
    private readonly staff: StaffRepository,
    private readonly scope: StaffScope,
  ) {}

  async execute(
    actor: Actor,
    query: { q: string | null; active: boolean | null; page: number; pageSize: number },
  ): Promise<Omit<StaffPage, 'items'> & { items: StaffListItem[] }> {
    const scopeIds = await this.scope.visibleIds(actor);
    const page = await this.staff.list({ ...query, scopeIds });
    return {
      ...page,
      items: page.items.map((u) => ({
        ...u,
        canManage: actor.seesAll || u.id !== actor.userId,
      })),
    };
  }
}

@Injectable()
export class GetStaffUseCase {
  constructor(private readonly scope: StaffScope) {}

  execute(actor: Actor, id: string): Promise<StaffRecord> {
    return this.scope.assertVisible(actor, id);
  }
}

/** Active staff within the caller's visibility, for manager and assignment dropdowns. */
@Injectable()
export class ListAssignableStaffUseCase {
  constructor(
    private readonly staff: StaffRepository,
    private readonly scope: StaffScope,
  ) {}

  async execute(
    actor: Actor,
  ): Promise<
    {
      id: string;
      name: string;
      employeeCode: string;
      positionId: string | null;
      positionName: string | null;
    }[]
  > {
    const scopeIds = await this.scope.visibleIds(actor);
    const page = await this.staff.list({
      q: null,
      active: true,
      scopeIds,
      page: 1,
      pageSize: 100,
    });
    return page.items.map((u) => ({
      id: u.id,
      name: u.name,
      employeeCode: u.employeeCode,
      positionId: u.positionId,
      positionName: u.positionName,
    }));
  }
}

/** Positions the caller may create people in: Board/GM any, others only directly below theirs. */
@Injectable()
export class ListCreatablePositionsUseCase {
  constructor(private readonly positions: ListPositionsUseCase) {}

  async execute(actor: Actor): Promise<string[]> {
    const all = await this.positions.execute();
    return creatable(actor, all).map((p) => p.id);
  }
}

function creatable(actor: Actor, positions: PositionRecord[]): PositionRecord[] {
  if (actor.seesAll) return positions;
  return positions.filter((p) => p.parentId !== null && p.parentId === actor.positionId);
}

export interface CreateStaffInput {
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  dateOfBirth: string | null;
  dateOfJoining: string | null;
  positionId: string;
  managerId?: string | null;
  password?: string;
  generateTemporaryPassword?: boolean;
}

@Injectable()
export class PeekStaffCodeUseCase {
  constructor(private readonly staff: StaffRepository) {}

  async execute(): Promise<{ code: string }> {
    return { code: await this.staff.peekNextCode() };
  }
}

@Injectable()
export class CreateStaffUseCase {
  constructor(
    private readonly staff: StaffRepository,
    private readonly positions: FindPositionUseCase,
    private readonly listPositions: ListPositionsUseCase,
    private readonly activeIds: FindActiveUserIdsUseCase,
    private readonly preparePassword: PrepareNewPasswordUseCase,
  ) {}

  /** `temporaryPassword` is only present when it was generated; it is shown ONCE and never stored. */
  async execute(
    actor: Actor,
    input: CreateStaffInput,
  ): Promise<{ user: StaffRecord; temporaryPassword: string | null }> {
    const all = await this.listPositions.execute();
    const position = all.find((p) => p.id === input.positionId);
    if (!position) throw new ValidationError('The position does not exist', 'UNKNOWN_REFERENCE');
    if (!creatable(actor, all).some((p) => p.id === position.id)) {
      throw new ForbiddenError('You can only create users in the position directly below yours');
    }

    // New people report to the creator; only Board/GM may choose another manager.
    const managerId = actor.seesAll ? (input.managerId ?? null) : actor.userId;
    if (managerId && !(await this.activeIds.execute([managerId])).length) {
      throw new ValidationError('The manager must be an active staff member', 'UNKNOWN_REFERENCE');
    }

    const prepared = await this.preparePassword.execute({
      password: input.password,
      generate: input.generateTemporaryPassword,
      email: input.email,
      name: input.name,
    });

    const record: NewStaff = {
      name: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address,
      dateOfBirth: input.dateOfBirth,
      dateOfJoining: input.dateOfJoining,
      positionId: position.id,
      managerId,
      passwordHash: prepared.hash,
      roleId: position.roleId,
      homeBranchId: actor.homeBranchId,
      // All-branches positions need no access rows; others get the creator's home branch.
      branchAccessIds: position.allBranches || !actor.homeBranchId ? [] : [actor.homeBranchId],
    };
    const user = await this.staff.create(record, {
      action: 'user.create',
      userId: actor.userId,
      // Never the password, generated or not.
      changes: {
        email: input.email,
        name: input.name,
        positionId: position.id,
        managerId,
        temporaryPassword: prepared.generated,
      },
    });
    return { user, temporaryPassword: prepared.generated ? prepared.plain : null };
  }
}

@Injectable()
export class UpdateStaffUseCase {
  constructor(
    private readonly staff: StaffRepository,
    private readonly scope: StaffScope,
    private readonly positions: FindPositionUseCase,
    private readonly activeIds: FindActiveUserIdsUseCase,
  ) {}

  async execute(actor: Actor, id: string, input: StaffChanges): Promise<StaffRecord> {
    const current = await this.scope.assertManageable(actor, id);

    const movesPerson =
      (input.positionId !== undefined && input.positionId !== current.positionId) ||
      (input.managerId !== undefined && input.managerId !== current.managerId);
    if (movesPerson && !(actor.seesAll && actor.permissions.has('position.move'))) {
      throw new ForbiddenError('Only the Board can change a person’s position or manager');
    }

    let roleId: string | null | undefined;
    if (input.positionId !== undefined && input.positionId !== current.positionId) {
      const position = await this.positions.execute(input.positionId);
      if (!position) throw new ValidationError('The position does not exist', 'UNKNOWN_REFERENCE');
      roleId = position.roleId;
    }
    if (input.managerId) {
      const subtree = await this.staff.subtreeIds(id);
      if (subtree.includes(input.managerId)) {
        throw new ValidationError(
          'A person cannot report to themselves or to one of their own reports',
          'ORG_CYCLE',
        );
      }
      if (!(await this.activeIds.execute([input.managerId])).length) {
        throw new ValidationError(
          'The manager must be an active staff member',
          'UNKNOWN_REFERENCE',
        );
      }
    }

    const changed = (Object.keys(input) as (keyof StaffChanges)[]).filter(
      (key) =>
        input[key] !== undefined &&
        input[key] !== (current as unknown as Record<string, unknown>)[key],
    );
    return this.staff.update(
      id,
      { ...input, ...(roleId !== undefined ? { roleId } : {}) },
      {
        action: 'user.update',
        userId: actor.userId,
        changes: {
          fields: changed,
          before: Object.fromEntries(
            changed.map((k) => [k, (current as unknown as Record<string, unknown>)[k]]),
          ),
          after: Object.fromEntries(changed.map((k) => [k, input[k]])),
        },
      },
    );
  }
}

/** Deactivate (ends every session at once) or reactivate. Not for yourself. */
@Injectable()
export class SetStaffActiveUseCase {
  constructor(
    private readonly staff: StaffRepository,
    private readonly scope: StaffScope,
    private readonly revokeSessions: RevokeUserSessionsUseCase,
  ) {}

  async execute(actor: Actor, id: string, active: boolean): Promise<void> {
    const user = await this.scope.assertManageable(actor, id);
    if (id === actor.userId) throw new ForbiddenError('You cannot deactivate yourself');
    if (user.active === active) return;
    // The status flip alone already kills sessions (the per-request check needs an ACTIVE user);
    // revoking the sessions as well removes the refresh tokens so nothing can come back.
    await this.staff.setStatus(id, active ? 'ACTIVE' : 'DISABLED', {
      action: active ? 'user.reactivate' : 'user.deactivate',
      userId: actor.userId,
      changes: { employeeCode: user.employeeCode },
    });
    if (!active) await this.revokeSessions.execute(id, 'user_deactivated');
  }
}

/**
 * Delete only a row created by mistake. "History" = the person manages someone, created or is
 * assigned to a client, or appears in the audit log as an actor (logins included). Work sheets
 * will be added to this check when that module reaches the database. The SERVER decides: a
 * person with history gets 409 and must be deactivated instead. The employee code is never reused.
 */
@Injectable()
export class DeleteStaffUseCase {
  constructor(
    private readonly staff: StaffRepository,
    private readonly scope: StaffScope,
    private readonly clientFootprint: CountUserClientFootprintUseCase,
    private readonly auditFootprint: CountAuditEntriesByUserUseCase,
    private readonly revokeSessions: RevokeUserSessionsUseCase,
  ) {}

  async execute(actor: Actor, id: string): Promise<void> {
    const user = await this.scope.assertManageable(actor, id);
    if (id === actor.userId) throw new ForbiddenError('You cannot delete yourself');

    const [reports, clients, audit] = await Promise.all([
      this.staff.countReports(id),
      this.clientFootprint.execute(id),
      this.auditFootprint.execute(id),
    ]);
    const reasons = [
      reports ? `manages ${reports} ${reports === 1 ? 'person' : 'people'}` : null,
      clients ? 'is linked to clients' : null,
      audit ? 'has recorded activity' : null,
    ].filter((r): r is string => r !== null);
    if (reasons.length) {
      throw new ConflictError(
        `${user.name} has history (${reasons.join(', ')}), so they cannot be deleted. Deactivate them instead.`,
        'HAS_HISTORY',
      );
    }
    await this.staff.softDelete(id, {
      action: 'user.delete',
      userId: actor.userId,
      changes: { employeeCode: user.employeeCode, email: user.email },
    });
    await this.revokeSessions.execute(id, 'user_deleted');
  }
}
