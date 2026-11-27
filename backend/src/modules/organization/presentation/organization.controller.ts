import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../../../core/validation/zod-validation.pipe.js';
import type { Actor } from '../../access/domain/actor.js';
import {
  CurrentActor,
  RequireAnyPermission,
  RequirePermission,
} from '../../access/presentation/permissions.js';
import {
  CreateDepartmentUseCase,
  CreatePositionUseCase,
  ListDepartmentsUseCase,
  ListPositionsUseCase,
  UpdateDepartmentUseCase,
  UpdatePositionUseCase,
} from '../domain/organization.use-cases.js';
import {
  createDepartmentSchema,
  createPositionSchema,
  idParamSchema,
  updateDepartmentSchema,
  updatePositionSchema,
  type CreateDepartmentDto,
  type CreatePositionDto,
  type UpdateDepartmentDto,
  type UpdatePositionDto,
} from './organization.dto.js';

const READ = ['organization.view', 'users.view', 'roles.view', 'clients.view'] as const;

/** Departments and positions: read endpoints feed dropdowns; create/update keep the tree valid. */
@Controller()
export class OrganizationController {
  constructor(
    private readonly listDepartments: ListDepartmentsUseCase,
    private readonly listPositions: ListPositionsUseCase,
    private readonly createDepartment: CreateDepartmentUseCase,
    private readonly updateDepartment: UpdateDepartmentUseCase,
    private readonly createPosition: CreatePositionUseCase,
    private readonly updatePosition: UpdatePositionUseCase,
  ) {}

  @RequireAnyPermission(...READ)
  @Get('departments')
  async departments() {
    return { items: await this.listDepartments.execute() };
  }

  @RequirePermission('organization.create')
  @Post('departments')
  @HttpCode(201)
  addDepartment(
    @Body(new ZodValidationPipe(createDepartmentSchema)) body: CreateDepartmentDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.createDepartment.execute(actor, body);
  }

  @RequirePermission('organization.edit')
  @Patch('departments/:id')
  editDepartment(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateDepartmentSchema)) body: UpdateDepartmentDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.updateDepartment.execute(actor, id, body);
  }

  @RequireAnyPermission(...READ)
  @Get('positions')
  async positions() {
    return { items: await this.listPositions.execute() };
  }

  @RequirePermission('organization.create')
  @Post('positions')
  @HttpCode(201)
  addPosition(
    @Body(new ZodValidationPipe(createPositionSchema)) body: CreatePositionDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.createPosition.execute(actor, body);
  }

  @RequirePermission('organization.edit')
  @Patch('positions/:id')
  editPosition(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(updatePositionSchema)) body: UpdatePositionDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.updatePosition.execute(actor, id, body);
  }
}
