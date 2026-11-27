import { Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '../../../core/errors/app-error.js';
import type { Actor } from '../../access/domain/actor.js';
import {
  OrganisationTypePage,
  OrganisationTypeQuery,
  OrganisationTypeRecord,
} from './organisation-type.records.js';
import { OrganisationTypesRepository } from './organisation-types.repository.js';

/** "Pvt Co." becomes "pvt-co": lower case words joined by "-". */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class ListOrganisationTypesUseCase {
  constructor(private readonly types: OrganisationTypesRepository) {}

  execute(query: OrganisationTypeQuery): Promise<OrganisationTypePage> {
    return this.types.list(query);
  }
}

@Injectable()
export class PeekOrganisationTypeCodeUseCase {
  constructor(private readonly types: OrganisationTypesRepository) {}

  async execute(): Promise<{ code: string }> {
    return { code: await this.types.peekNextCode() };
  }
}

@Injectable()
export class CreateOrganisationTypeUseCase {
  constructor(private readonly types: OrganisationTypesRepository) {}

  execute(actor: Actor, input: { name: string }): Promise<OrganisationTypeRecord> {
    const key = slugify(input.name);
    if (!key) {
      throw new ValidationError('The name needs letters or numbers', 'VALIDATION_ERROR');
    }
    return this.types.create(input.name, key, {
      action: 'organisation_type.create',
      userId: actor.userId,
      changes: { name: input.name },
    });
  }
}

@Injectable()
export class UpdateOrganisationTypeUseCase {
  constructor(private readonly types: OrganisationTypesRepository) {}

  async execute(
    actor: Actor,
    id: string,
    input: { name: string },
  ): Promise<OrganisationTypeRecord> {
    // The key (slug) is never re-derived: clients keep pointing at the same type after a rename.
    if (!slugify(input.name)) {
      throw new ValidationError('The name needs letters or numbers', 'VALIDATION_ERROR');
    }
    const updated = await this.types.rename(id, input.name, {
      action: 'organisation_type.update',
      userId: actor.userId,
      changes: {},
    });
    if (!updated) throw new NotFoundError('Organisation type not found');
    return updated;
  }
}
