import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../../../core/validation/zod-validation.pipe.js';
import type { Actor } from '../../access/domain/actor.js';
import { CurrentActor, RequirePermission } from '../../access/presentation/permissions.js';
import {
  CreateHrDepartmentUseCase,
  CreateHrDesignationUseCase,
  CreateHrEmployeeUseCase,
  ListHrDepartmentsUseCase,
  ListHrDesignationsUseCase,
  ListHrEmployeesUseCase,
  ListHrOptionsUseCase,
  PeekHrCodeUseCase,
} from '../domain/people.use-cases.js';
import {
  createDepartmentSchema,
  createDesignationSchema,
  createEmployeeSchema,
  listPeopleQuerySchema,
  type CreateDepartmentDto,
  type CreateDesignationDto,
  type CreateEmployeeDto,
  type ListPeopleQuery,
} from './people.dto.js';

const listQuery = new ZodValidationPipe(listPeopleQuerySchema);

/**
 * HR directory (HR > Employees): departments, designations and employees. Independent of the
 * organisation hierarchy. `hr.view` reads, `hr.create` adds.
 */
@Controller('hr')
export class PeopleController {
  constructor(
    private readonly listDepartments: ListHrDepartmentsUseCase,
    private readonly listDesignations: ListHrDesignationsUseCase,
    private readonly listEmployees: ListHrEmployeesUseCase,
    private readonly options: ListHrOptionsUseCase,
    private readonly peek: PeekHrCodeUseCase,
    private readonly createDepartment: CreateHrDepartmentUseCase,
    private readonly createDesignation: CreateHrDesignationUseCase,
    private readonly createEmployee: CreateHrEmployeeUseCase,
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
    return this.listEmployees.execute(query);
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
    @Body(new ZodValidationPipe(createEmployeeSchema)) body: CreateEmployeeDto,
    @CurrentActor() actor: Actor,
  ) {
    return this.createEmployee.execute(actor, body);
  }
}
