import { Controller, Get } from '@nestjs/common';
import { ListRolesUseCase } from '../domain/list-roles.use-case.js';
import { RequireAnyPermission } from './permissions.js';

@Controller('roles')
export class RolesController {
  constructor(private readonly listRoles: ListRolesUseCase) {}

  /** Feeds dropdowns (position role) and the read-only roles page. */
  @RequireAnyPermission('roles.view', 'organization.view', 'users.view')
  @Get()
  async list() {
    return { items: await this.listRoles.execute() };
  }
}
