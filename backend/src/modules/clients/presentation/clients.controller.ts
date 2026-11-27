import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../../core/validation/zod-validation.pipe.js';
import type { Actor } from '../../access/domain/actor.js';
import {
  CurrentActor,
  RequireAnyPermission,
  RequirePermission,
} from '../../access/presentation/permissions.js';
import { ListEntityAuditUseCase } from '../../audit/domain/record-audit.use-case.js';
import { clientContext } from '../../auth/presentation/auth-http.js';
import { CREDENTIAL_AUDIT } from '../../credentials/domain/credential-fields.js';
import {
  RevealCredentialUseCase,
  SetCredentialUseCase,
} from '../../credentials/domain/credentials.use-cases.js';
import {
  CreateClientUseCase,
  GetClientReferenceDataUseCase,
  GetClientUseCase,
  ListClientsUseCase,
  ListTeamOptionsUseCase,
  PeekClientCodeUseCase,
  SetClientActiveUseCase,
  UpdateClientUseCase,
} from '../domain/clients.use-cases.js';
import {
  createClientSchema,
  listClientsQuerySchema,
  revealCredentialSchema,
  setActiveSchema,
  setCredentialSchema,
  updateClientSchema,
  type CreateClientDto,
  type ListClientsQuery,
  type RevealCredentialDto,
  type SetActiveDto,
  type SetCredentialDto,
  type UpdateClientDto,
} from './clients.dto.js';
import { z } from 'zod';

const idParam = new ZodValidationPipe(z.string().uuid());

/** Maps the credential audit actions to what the UI shows ("revealed", "updated"...). */
const AUDIT_LABEL: Record<string, 'revealed' | 'updated' | 'cleared' | 'denied' | 'blocked'> = {
  [CREDENTIAL_AUDIT.reveal]: 'revealed',
  [CREDENTIAL_AUDIT.update]: 'updated',
  [CREDENTIAL_AUDIT.clear]: 'cleared',
  [CREDENTIAL_AUDIT.denied]: 'denied',
  [CREDENTIAL_AUDIT.blocked]: 'blocked',
};

@Controller('clients')
export class ClientsController {
  constructor(
    private readonly listClients: ListClientsUseCase,
    private readonly getClient: GetClientUseCase,
    private readonly referenceData: GetClientReferenceDataUseCase,
    private readonly teamOptions: ListTeamOptionsUseCase,
    private readonly peekCode: PeekClientCodeUseCase,
    private readonly createClient: CreateClientUseCase,
    private readonly updateClient: UpdateClientUseCase,
    private readonly setClientActive: SetClientActiveUseCase,
    private readonly setCredential: SetCredentialUseCase,
    private readonly revealCredential: RevealCredentialUseCase,
    private readonly listAudit: ListEntityAuditUseCase,
  ) {}

  @RequirePermission('clients.view')
  @Get()
  list(
    @Query(new ZodValidationPipe(listClientsQuerySchema)) query: ListClientsQuery,
    @CurrentActor() actor: Actor,
  ) {
    return this.listClients.execute(actor, query);
  }

  // Fixed paths come before ':id'.
  @RequirePermission('clients.view')
  @Get('reference-data')
  reference() {
    return this.referenceData.execute();
  }

  @RequirePermission('clients.create')
  @Get('next-code')
  nextCode() {
    return this.peekCode.execute();
  }

  @RequirePermission('clients.view')
  @Get('team-options')
  async team() {
    return { items: await this.teamOptions.execute() };
  }

  @RequirePermission('clients.view')
  @Get(':id')
  get(@Param('id', idParam) id: string, @CurrentActor() actor: Actor) {
    return this.getClient.execute(actor, id);
  }

  @RequirePermission('clients.create')
  @Post()
  @HttpCode(201)
  create(
    @Body(new ZodValidationPipe(createClientSchema)) body: CreateClientDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.createClient.execute(actor, body);
  }

  @RequirePermission('clients.edit')
  @Put(':id')
  update(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(updateClientSchema)) body: UpdateClientDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.updateClient.execute(actor, id, body);
  }

  @RequirePermission('clients.deactivate')
  @Patch(':id/active')
  @HttpCode(204)
  async active(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(setActiveSchema)) body: SetActiveDto,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    await this.setClientActive.execute(actor, id, body.active);
  }

  /** Write-only: there is no endpoint that returns a stored value except the audited reveal. */
  @RequirePermission('clients.edit')
  @Put(':id/credentials')
  @HttpCode(204)
  async setCredentialValue(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(setCredentialSchema)) body: SetCredentialDto,
    @CurrentActor() actor: Actor,
    @Req() req: Request,
  ): Promise<void> {
    const client = await this.getClient.find(actor, id);
    await this.setCredential.execute(
      actor,
      { clientId: id, branchId: client.branchId, ip: clientContext(req).ip },
      body.key,
      body.value,
    );
  }

  /** Needs clients.reveal_credentials AND the user's current password. Never cached. */
  @RequirePermission('clients.reveal_credentials')
  @Post(':id/credentials/reveal')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async reveal(
    @Param('id', idParam) id: string,
    @Body(new ZodValidationPipe(revealCredentialSchema)) body: RevealCredentialDto,
    @CurrentActor() actor: Actor,
    @Req() req: Request,
  ): Promise<{ value: string }> {
    const client = await this.getClient.find(actor, id);
    const value = await this.revealCredential.execute(
      actor,
      { clientId: id, branchId: client.branchId, ip: clientContext(req).ip },
      { field: body.key, password: body.password, worksheetId: body.worksheetId ?? null },
    );
    return { value };
  }

  /** Who revealed or changed which field, and when. Never the values. */
  @RequireAnyPermission('clients.reveal_credentials', 'clients.edit')
  @Get(':id/credentials/audit')
  async credentialAudit(@Param('id', idParam) id: string, @CurrentActor() actor: Actor) {
    await this.getClient.find(actor, id);
    const rows = await this.listAudit.execute('client', id, Object.keys(AUDIT_LABEL), 50);
    return {
      items: rows.map((r) => ({
        id: r.id,
        at: r.at.toISOString(),
        userId: r.userId ?? '',
        userName: r.userName ?? '',
        action: AUDIT_LABEL[r.action] ?? r.action,
        key: typeof r.changes?.['field'] === 'string' ? r.changes['field'] : null,
        worksheetId:
          typeof r.changes?.['worksheetId'] === 'string' ? r.changes['worksheetId'] : null,
      })),
    };
  }
}
