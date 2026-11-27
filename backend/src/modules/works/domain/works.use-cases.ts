import { Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '../../../core/errors/app-error.js';
import type { Actor } from '../../access/domain/actor.js';
import {
  WorkPage,
  WorkQuery,
  WorkRecord,
} from './work.records.js';
import { WorksRepository } from './works.repository.js';

/** "TDS Returns" becomes "tds-returns": lower case words joined by "-". */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class ListWorksUseCase {
  constructor(private readonly types: WorksRepository) {}

  execute(query: WorkQuery): Promise<WorkPage> {
    return this.types.list(query);
  }
}

@Injectable()
export class PeekWorkCodeUseCase {
  constructor(private readonly types: WorksRepository) {}

  async execute(): Promise<{ code: string }> {
    return { code: await this.types.peekNextCode() };
  }
}

@Injectable()
export class CreateWorkUseCase {
  constructor(private readonly types: WorksRepository) {}

  execute(actor: Actor, input: { name: string }): Promise<WorkRecord> {
    const key = slugify(input.name);
    if (!key) {
      throw new ValidationError('The name needs letters or numbers', 'VALIDATION_ERROR');
    }
    return this.types.create(input.name, key, {
      action: 'work.create',
      userId: actor.userId,
      changes: { name: input.name },
    });
  }
}

@Injectable()
export class UpdateWorkUseCase {
  constructor(private readonly types: WorksRepository) {}

  async execute(
    actor: Actor,
    id: string,
    input: { name: string },
  ): Promise<WorkRecord> {
    // The key (slug) is never re-derived: clients keep pointing at the same work after a rename.
    if (!slugify(input.name)) {
      throw new ValidationError('The name needs letters or numbers', 'VALIDATION_ERROR');
    }
    const updated = await this.types.rename(id, input.name, {
      action: 'work.update',
      userId: actor.userId,
      changes: {},
    });
    if (!updated) throw new NotFoundError('Works not found');
    return updated;
  }
}
