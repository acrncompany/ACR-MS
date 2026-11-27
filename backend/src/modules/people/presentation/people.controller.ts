import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../../core/validation/zod-validation.pipe.js';
import type { Actor } from '../../access/domain/actor.js';
import { CurrentActor, RequirePermission } from '../../access/presentation/permissions.js';
import type { PersonDocumentKind } from '../domain/people.records.js';
import {
  CreateHrDepartmentUseCase,
  CreateHrDesignationUseCase,
  CreateHrPersonUseCase,
  DeleteHrPersonUseCase,
  GetHrAdditionalDocumentUseCase,
  GetHrDocumentUseCase,
  GetHrPersonUseCase,
  ListHrDepartmentsUseCase,
  ListHrDesignationsUseCase,
  ListHrOptionsUseCase,
  ListHrPeopleUseCase,
  PeekHrCodeUseCase,
  UpdateHrPersonUseCase,
  UploadHrAdditionalDocumentUseCase,
  UploadHrDocumentUseCase,
} from '../domain/people.use-cases.js';
import {
  createDepartmentSchema,
  createDesignationSchema,
  createPersonSchema,
  documentKindSchema,
  listPeopleQuerySchema,
  uploadQuerySchema,
  type CreateDepartmentDto,
  type CreateDesignationDto,
  type CreatePersonDto,
  type ListPeopleQuery,
  type UploadQuery,
} from './people.dto.js';

const listQuery = new ZodValidationPipe(listPeopleQuerySchema);
const documentKind = new ZodValidationPipe(documentKindSchema);
const uploadQuery = new ZodValidationPipe(uploadQuerySchema);

interface ServedFile {
  fileName: string;
  mime: string;
  data: Buffer;
}

/** Serves a stored document inline. Private data: never cached, never sniffed. */
function send(res: Response, file: ServedFile): void {
  res
    .status(200)
    .setHeader('Content-Type', file.mime)
    .setHeader('Content-Length', file.data.length)
    .setHeader('Cache-Control', 'private, no-store')
    .setHeader('X-Content-Type-Options', 'nosniff')
    .setHeader(
      'Content-Disposition',
      "inline; filename*=UTF-8''" + encodeURIComponent(file.fileName),
    )
    .end(file.data);
}

/**
 * HR directory (People): departments, designations, employees and articles. Independent of the
 * organisation hierarchy. `hr.view` reads (including opening a document), `hr.create` adds and
 * uploads. Employees and articles share one profile and the same use cases.
 */
@Controller('hr')
export class PeopleController {
  constructor(
    private readonly listDepartments: ListHrDepartmentsUseCase,
    private readonly listDesignations: ListHrDesignationsUseCase,
    private readonly listPeople: ListHrPeopleUseCase,
    private readonly getPerson: GetHrPersonUseCase,
    private readonly options: ListHrOptionsUseCase,
    private readonly peek: PeekHrCodeUseCase,
    private readonly createDepartment: CreateHrDepartmentUseCase,
    private readonly createDesignation: CreateHrDesignationUseCase,
    private readonly createPerson: CreateHrPersonUseCase,
    private readonly updatePerson: UpdateHrPersonUseCase,
    private readonly deletePerson: DeleteHrPersonUseCase,
    private readonly uploadDocument: UploadHrDocumentUseCase,
    private readonly readDocument: GetHrDocumentUseCase,
    private readonly addExtra: UploadHrAdditionalDocumentUseCase,
    private readonly readExtra: GetHrAdditionalDocumentUseCase,
  ) {}

  // ---------------------------------------------------------------- departments
  @RequirePermission('hr.view')
  @Get('departments')
  departments(@Query(listQuery) query: ListPeopleQuery) {
    return this.listDepartments.execute(query);
  }

  @RequirePermission('hr.view')
  @Get('departments/options')
  departmentOptions() {
    return this.options.departments();
  }

  @RequirePermission('hr.create')
  @Get('departments/next-code')
  departmentCode() {
    return this.peek.execute('department');
  }

  @RequirePermission('hr.create')
  @Post('departments')
  @HttpCode(201)
  addDepartment(
    @Body(new ZodValidationPipe(createDepartmentSchema)) body: CreateDepartmentDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.createDepartment.execute(actor, body);
  }

  // ---------------------------------------------------------------- designations
  @RequirePermission('hr.view')
  @Get('designations')
  designations(@Query(listQuery) query: ListPeopleQuery) {
    return this.listDesignations.execute(query);
  }

  @RequirePermission('hr.view')
  @Get('designations/options')
  designationOptions() {
    return this.options.designations();
  }

  @RequirePermission('hr.create')
  @Get('designations/next-code')
  designationCode() {
    return this.peek.execute('designation');
  }

  @RequirePermission('hr.create')
  @Post('designations')
  @HttpCode(201)
  addDesignation(
    @Body(new ZodValidationPipe(createDesignationSchema)) body: CreateDesignationDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.createDesignation.execute(actor, body);
  }

  // ---------------------------------------------------------------- employees
  @RequirePermission('hr.view')
  @Get('employees')
  employees(@Query(listQuery) query: ListPeopleQuery) {
    return this.listPeople.execute('employee', query);
  }

  /** Active employees for the "reporting manager" dropdown (employees and articles use it). */
  @RequirePermission('hr.view')
  @Get('employees/options')
  employeeOptions() {
    return this.options.employees();
  }

  @RequirePermission('hr.create')
  @Get('employees/next-code')
  employeeCode() {
    return this.peek.execute('employee');
  }

  @RequirePermission('hr.create')
  @Post('employees')
  @HttpCode(201)
  addEmployee(
    @Body(new ZodValidationPipe(createPersonSchema)) body: CreatePersonDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.createPerson.execute(actor, 'employee', body);
  }

  @RequirePermission('hr.view')
  @Get('employees/:id')
  employee(@Param('id', ParseUUIDPipe) id: string) {
    return this.getPerson.execute('employee', id);
  }

  @RequirePermission('hr.edit')
  @Put('employees/:id')
  editEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createPersonSchema)) body: CreatePersonDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.updatePerson.execute(actor, 'employee', id, body);
  }

  /** DEVELOPMENT ONLY (refused in production): deletes the record for good. */
  @RequirePermission('hr.edit')
  @Delete('employees/:id')
  @HttpCode(204)
  async removeEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    await this.deletePerson.execute(actor, 'employee', id);
  }

  @RequirePermission('hr.create')
  @Post('employees/:id/documents/:document')
  @HttpCode(201)
  uploadEmployeeDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('document', documentKind) document: PersonDocumentKind,
    @Query(uploadQuery) query: UploadQuery,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ) {
    return this.uploadDocument.execute(actor, 'employee', id, document, query.fileName, body);
  }

  @RequirePermission('hr.view')
  @Get('employees/:id/documents/:document')
  async employeeDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('document', documentKind) document: PersonDocumentKind,
    @Res() res: Response,
  ): Promise<void> {
    send(res, await this.readDocument.execute('employee', id, document));
  }

  @RequirePermission('hr.create')
  @Post('employees/:id/additional-documents')
  @HttpCode(201)
  addAdditionalEmployeeDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(uploadQuery) query: UploadQuery,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ) {
    return this.addExtra.execute(actor, 'employee', id, query.title, query.fileName, body);
  }

  @RequirePermission('hr.view')
  @Get('employees/:id/additional-documents/:documentId')
  async additionalEmployeeDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res() res: Response,
  ): Promise<void> {
    send(res, await this.readExtra.execute('employee', id, documentId));
  }

  // ---------------------------------------------------------------- articles
  @RequirePermission('hr.view')
  @Get('articles')
  articles(@Query(listQuery) query: ListPeopleQuery) {
    return this.listPeople.execute('article', query);
  }

  @RequirePermission('hr.create')
  @Get('articles/next-code')
  articleCode() {
    return this.peek.execute('article');
  }

  @RequirePermission('hr.create')
  @Post('articles')
  @HttpCode(201)
  addArticle(
    @Body(new ZodValidationPipe(createPersonSchema)) body: CreatePersonDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.createPerson.execute(actor, 'article', body);
  }

  @RequirePermission('hr.view')
  @Get('articles/:id')
  article(@Param('id', ParseUUIDPipe) id: string) {
    return this.getPerson.execute('article', id);
  }

  @RequirePermission('hr.edit')
  @Put('articles/:id')
  editArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createPersonSchema)) body: CreatePersonDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.updatePerson.execute(actor, 'article', id, body);
  }

  /** DEVELOPMENT ONLY (refused in production): deletes the record for good. */
  @RequirePermission('hr.edit')
  @Delete('articles/:id')
  @HttpCode(204)
  async removeArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    await this.deletePerson.execute(actor, 'article', id);
  }

  @RequirePermission('hr.create')
  @Post('articles/:id/documents/:document')
  @HttpCode(201)
  uploadArticleDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('document', documentKind) document: PersonDocumentKind,
    @Query(uploadQuery) query: UploadQuery,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ) {
    return this.uploadDocument.execute(actor, 'article', id, document, query.fileName, body);
  }

  @RequirePermission('hr.view')
  @Get('articles/:id/documents/:document')
  async articleDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('document', documentKind) document: PersonDocumentKind,
    @Res() res: Response,
  ): Promise<void> {
    send(res, await this.readDocument.execute('article', id, document));
  }

  @RequirePermission('hr.create')
  @Post('articles/:id/additional-documents')
  @HttpCode(201)
  addAdditionalArticleDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(uploadQuery) query: UploadQuery,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ) {
    return this.addExtra.execute(actor, 'article', id, query.title, query.fileName, body);
  }

  @RequirePermission('hr.view')
  @Get('articles/:id/additional-documents/:documentId')
  async additionalArticleDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res() res: Response,
  ): Promise<void> {
    send(res, await this.readExtra.execute('article', id, documentId));
  }
}
