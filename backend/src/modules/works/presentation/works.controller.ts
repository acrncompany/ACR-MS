import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../../../core/validation/zod-validation.pipe.js';
import type { Actor } from '../../access/domain/actor.js';
import { CurrentActor, RequirePermission } from '../../access/presentation/permissions.js';
import {
  CreateWorkUseCase,
  ListWorksUseCase,
  PeekWorkCodeUseCase,
  UpdateWorkUseCase,
} from '../domain/works.use-cases.js';
import {
  createWorkSchema,
  listWorksQuerySchema,
  updateWorkSchema,
  type CreateWorkDto,
  type ListWorksQuery,
  type UpdateWorkDto,
} from './works.dto.js';

/** Works master. Same permissions as the client master it feeds. */
@Controller('works')
export class WorksController {
  constructor(
    private readonly listTypes: ListWorksUseCase,
    private readonly createType: CreateWorkUseCase,
    private readonly updateType: UpdateWorkUseCase,
    private readonly peekCode: PeekWorkCodeUseCase,
  ) {}

  @RequirePermission('clients.view')
  @Get()
  list(
    @Query(new ZodValidationPipe(listWorksQuerySchema))
    query: ListWorksQuery,
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
    @Body(new ZodValidationPipe(createWorkSchema)) body: CreateWorkDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.createType.execute(actor, body);
  }

  @RequirePermission('clients.create')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateWorkSchema)) body: UpdateWorkDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.updateType.execute(actor, id, body);
  }
}
