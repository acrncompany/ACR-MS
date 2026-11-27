import { Injectable } from '@nestjs/common';
import { AccessRepository, RoleWithPermissions } from './access.repository.js';

/** Roles and the permission keys each grants (read-only; role editing is on the backlog). */
@Injectable()
export class ListRolesUseCase {
  constructor(private readonly access: AccessRepository) {}

  execute(): Promise<RoleWithPermissions[]> {
    return this.access.listRoles();
  }
}
