import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../../core/validation/zod-validation.pipe.js';
import type { Actor } from '../../access/domain/actor.js';
import { CurrentActor, RequirePermission } from '../../access/presentation/permissions.js';
import {
  CreateStaffUseCase,
  DeleteStaffUseCase,
  GetStaffUseCase,
  ListAssignableStaffUseCase,
  ListCreatablePositionsUseCase,
  ListStaffUseCase,
  PeekStaffCodeUseCase,
  SetStaffActiveUseCase,
  UpdateStaffUseCase,
} from '../domain/staff.use-cases.js';
import {
  createStaffSchema,
  listStaffQuerySchema,
  staffIdParam,
  updateStaffSchema,
  type CreateStaffDto,
  type ListStaffQuery,
  type UpdateStaffDto,
} from './staff.dto.js';

const idParam = new ZodValidationPipe(staffIdParam);

/** Staff (users). Visibility and the "who may manage whom" rules are enforced here, not in the UI. */
@Controller('users')
export class StaffController {
  constructor(
    private readonly listStaff: ListStaffUseCase,
    private readonly getStaff: GetStaffUseCase,
    private readonly assignable: ListAssignableStaffUseCase,
    private readonly creatablePositions: ListCreatablePositionsUseCase,
    private readonly createStaff: CreateStaffUseCase,
    private readonly updateStaff: UpdateStaffUseCase,
    private readonly setActive: SetStaffActiveUseCase,
    private readonly deleteStaff: DeleteStaffUseCase,
    private readonly peekCode: PeekStaffCodeUseCase,
  ) {}

  @RequirePermission('users.view')
  @Get()
  list(
    @Query(new ZodValidationPipe(listStaffQuerySchema)) query: ListStaffQuery,
    @CurrentActor() actor: Actor,
  ) {
    return this.listStaff.execute(actor, query);
  }

  // Fixed paths come before ':id'.
  @RequirePermission('users.view')
  @Get('assignable')
  async assignableUsers(@CurrentActor() actor: Actor) {
    return { items: await this.assignable.execute(actor) };
  }

  @RequirePermission('users.view')
  @Get('creatable-positions')
  async creatable(@CurrentActor() actor: Actor) {
    return { positionIds: await this.creatablePositions.execute(actor) };
  }

  /** Preview only (the employee code is issued when the person is saved). */
  @RequirePermission('users.create')
  @Get('next-code')
  nextCode() {
    return this.peekCode.execute();
  }

  @RequirePermission('users.view')
  @Get(':id')
  get(@Param('id', idParam) id: string, @CurrentActor() actor: Actor) {
    return this.getStaff.execute(actor, id);
  }

  /** A generated temporary password is in the response ONCE; the response is never cached. */
  @RequirePermission('users.create')
  @Post()
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  create(
    @Body(new ZodValidationPipe(createStaffSchema)) body: CreateStaffDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.createStaff.execute(actor, body);
  }

  @RequirePermission('users.edit')
  @Patch(':id')
  update(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateStaffSchema)) body: UpdateStaffDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.updateStaff.execute(actor, id, body);
  }

  @RequirePermission('users.deactivate')
  @Post(':id/deactivate')
  @HttpCode(204)
  async deactivate(@Param('id', idParam) id: string, @CurrentActor() actor: Actor): Promise<void> {
    await this.setActive.execute(actor, id, false);
  }

  @RequirePermission('users.deactivate')
  @Post(':id/reactivate')
  @HttpCode(204)
  async reactivate(@Param('id', idParam) id: string, @CurrentActor() actor: Actor): Promise<void> {
    await this.setActive.execute(actor, id, true);
  }

  /** 409 with a clear message when the person has history. */
  @RequirePermission('users.deactivate')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', idParam) id: string, @CurrentActor() actor: Actor): Promise<void> {
    await this.deleteStaff.execute(actor, id);
  }
}
