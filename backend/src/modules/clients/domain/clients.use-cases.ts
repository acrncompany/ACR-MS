import { Injectable } from '@nestjs/common';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../core/errors/app-error.js';
import type { Actor } from '../../access/domain/actor.js';
import { ListCredentialFieldsUseCase } from '../../credentials/domain/credentials.use-cases.js';
import {
  FindActiveUserIdsUseCase,
  ListActiveUsersUseCase,
} from '../../user/domain/active-users.use-cases.js';
import {
  ClientDetail,
  ClientPage,
  ClientQuery,
  ClientRecord,
  ClientWrite,
  ReferenceData,
} from './client.records.js';
import { ClientsRepository } from './clients.repository.js';

/** Branch visibility: clients of the actor's branches; everything for an all-branches position. */
export function branchScope(actor: Actor): string[] | null {
  return actor.allBranches ? null : actor.branchIds;
}

/**
 * LIST: client master visibility is CURRENTLY "everyone with clients.view, within their
 * branches". To be reviewed for client confidentiality (restrict to the assigned team) later.
 */
@Injectable()
export class ListClientsUseCase {
  constructor(private readonly clients: ClientsRepository) {}

  execute(actor: Actor, query: Omit<ClientQuery, 'branchIds'>): Promise<ClientPage> {
    return this.clients.list({ ...query, branchIds: branchScope(actor) });
  }
}

@Injectable()
export class GetClientUseCase {
  constructor(
    private readonly clients: ClientsRepository,
    private readonly credentialFields: ListCredentialFieldsUseCase,
  ) {}

  /** The record WITHOUT credentials (also the visibility check for the credential endpoints). */
  async find(actor: Actor, id: string): Promise<ClientRecord> {
    const client = await this.clients.findById(id, branchScope(actor));
    if (!client) throw new NotFoundError('Client not found');
    return client;
  }

  async execute(actor: Actor, id: string): Promise<ClientDetail> {
    const client = await this.find(actor, id);
    return { ...client, credentialsSet: await this.credentialFields.execute(id) };
  }
}

@Injectable()
export class GetClientReferenceDataUseCase {
  constructor(private readonly clients: ClientsRepository) {}

  execute(): Promise<ReferenceData> {
    return this.clients.referenceData();
  }
}

/** The code the next client will most likely get; shown in the "new client" form only. */
@Injectable()
export class PeekClientCodeUseCase {
  constructor(private readonly clients: ClientsRepository) {}

  async execute(): Promise<{ code: string }> {
    return { code: await this.clients.peekNextCode() };
  }
}

/** Active staff who can be put on a client's team (names and codes only). */
@Injectable()
export class ListTeamOptionsUseCase {
  constructor(private readonly users: ListActiveUsersUseCase) {}

  async execute(): Promise<{ id: string; name: string; employeeCode: string }[]> {
    const users = await this.users.execute();
    return users.map((u) => ({ id: u.id, name: u.name, employeeCode: u.employeeCode }));
  }
}

@Injectable()
export class CreateClientUseCase {
  constructor(
    private readonly clients: ClientsRepository,
    private readonly activeIds: FindActiveUserIdsUseCase,
  ) {}

  async execute(actor: Actor, input: ClientWrite & { branchId?: string }): Promise<ClientRecord> {
    const { branchId: requested, ...write } = input;
    const branchId = requested ?? actor.homeBranchId;
    if (!branchId) {
      throw new ValidationError('Choose a branch for the client', 'BRANCH_REQUIRED');
    }
    if (!actor.allBranches && !actor.branchIds.includes(branchId)) {
      throw new ForbiddenError('You cannot create clients in this branch');
    }
    await ensureActiveTeam(this.activeIds, write.teamIds);
    return this.clients.create(write, branchId, {
      action: 'client.create',
      userId: actor.userId,
      changes: summary(write),
    });
  }
}

@Injectable()
export class UpdateClientUseCase {
  constructor(
    private readonly clients: ClientsRepository,
    private readonly activeIds: FindActiveUserIdsUseCase,
  ) {}

  async execute(actor: Actor, id: string, input: ClientWrite): Promise<ClientRecord> {
    const current = await this.clients.findById(id, branchScope(actor));
    if (!current) throw new NotFoundError('Client not found');
    // Team members who were already on the client stay even if now deactivated; new ones must be active.
    const added = input.teamIds.filter((t) => !current.teamIds.includes(t));
    await ensureActiveTeam(this.activeIds, added);
    const before = summary(toWrite(current));
    const after = summary(input);
    const changed = Object.keys(after).filter(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
    );
    return this.clients.update(id, input, {
      action: 'client.update',
      userId: actor.userId,
      changes: {
        fields: changed,
        before: pick(before, changed),
        after: pick(after, changed),
      },
    });
  }
}

/** Deactivate or reactivate. There is no delete: a client keeps its history and its code. */
@Injectable()
export class SetClientActiveUseCase {
  constructor(private readonly clients: ClientsRepository) {}

  async execute(actor: Actor, id: string, active: boolean): Promise<void> {
    const current = await this.clients.findById(id, branchScope(actor));
    if (!current) throw new NotFoundError('Client not found');
    if (current.active === active) return;
    await this.clients.setActive(id, active, {
      action: active ? 'client.reactivate' : 'client.deactivate',
      userId: actor.userId,
      changes: { clientCode: current.clientCode },
    });
  }
}

/** Part of the "has history" check before a person may be deleted. */
@Injectable()
export class CountUserClientFootprintUseCase {
  constructor(private readonly clients: ClientsRepository) {}

  execute(userId: string): Promise<number> {
    return this.clients.countTouchedBy(userId);
  }
}

async function ensureActiveTeam(activeIds: FindActiveUserIdsUseCase, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const found = new Set(await activeIds.execute(ids));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) {
    throw new ValidationError(
      'Team members must be active staff of this company',
      'UNKNOWN_REFERENCE',
    );
  }
}

function toWrite(c: ClientRecord): ClientWrite {
  return {
    name: c.name,
    address: c.address,
    city: c.city,
    email: c.email,
    phone: c.phone,
    organisationType: c.organisationType,
    cinFrn: c.cinFrn,
    incorporationDate: c.incorporationDate,
    pan: c.pan,
    gstin: c.gstin,
    previousAuditor: c.previousAuditor,
    directors: c.directors.map((d) => ({
      name: d.name,
      din: d.din,
      phone: d.phone,
      email: d.email,
      kycStatus: d.kycStatus,
    })),
    lawKeys: c.lawKeys,
    teamIds: c.teamIds,
  };
}

/** Everything about a client is non-secret (credentials live in their own table and audit). */
function summary(w: ClientWrite): Record<string, unknown> {
  return {
    name: w.name,
    address: w.address,
    city: w.city,
    email: w.email,
    phone: w.phone,
    organisationType: w.organisationType,
    cinFrn: w.cinFrn,
    incorporationDate: w.incorporationDate,
    pan: w.pan,
    gstin: w.gstin,
    previousAuditor: w.previousAuditor,
    directors: w.directors.map((d) => ({ name: d.name, din: d.din, kycStatus: d.kycStatus })),
    lawKeys: [...w.lawKeys].sort(),
    teamIds: [...w.teamIds].sort(),
  };
}

function pick(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((k) => [k, source[k]]));
}
