import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../../../core/validation/zod-validation.pipe.js';
import type { Actor } from '../../access/domain/actor.js';
import { CurrentActor, RequirePermission } from '../../access/presentation/permissions.js';
import {
  CreateOrganisationTypeUseCase,
  ListOrganisationTypesUseCase,
  PeekOrganisationTypeCodeUseCase,
  UpdateOrganisationTypeUseCase,
} from '../domain/organisation-types.use-cases.js';
import {
  createOrganisationTypeSchema,
  listOrganisationTypesQuerySchema,
  updateOrganisationTypeSchema,
  type CreateOrganisationTypeDto,
  type ListOrganisationTypesQuery,
  type UpdateOrganisationTypeDto,
} from './organisation-types.dto.js';

/** Organisation type master. Same permissions as the client master it feeds. */
@Controller('organisation-types')
export class OrganisationTypesController {
  constructor(
    private readonly listTypes: ListOrganisationTypesUseCase,
    private readonly createType: CreateOrganisationTypeUseCase,
    private readonly updateType: UpdateOrganisationTypeUseCase,
    private readonly peekCode: PeekOrganisationTypeCodeUseCase,
  ) {}

  @RequirePermission('clients.view')
  @Get()
  list(
    @Query(new ZodValidationPipe(listOrganisationTypesQuerySchema))
    query: ListOrganisationTypesQuery,
  ) {
    return this.listTypes.execute(query);
  }

  /** Preview only (the code is issued when the type is saved). Fixed path, before ':id'. */
  @RequirePermission('clients.create')
  @Get('next-code')
  nextCode() {
    return this.peekCode.execute();
  }

  @RequirePermission('clients.create')
  @Post()
  @HttpCode(201)
  create(
    @Body(new ZodValidationPipe(createOrganisationTypeSchema)) body: CreateOrganisationTypeDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.createType.execute(actor, body);
  }

  @RequirePermission('clients.create')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateOrganisationTypeSchema)) body: UpdateOrganisationTypeDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.updateType.execute(actor, id, body);
  }
}
