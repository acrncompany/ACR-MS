import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AppConfigService } from '../../../core/config/app-config.service';
import { Page, PageQuery } from '../../../core/http/page';
import {
  DepartmentEntry,
  DepartmentInput,
  DesignationEntry,
  DesignationInput,
  DirectoryKind,
  DirectoryOption,
  EmployeeEntry,
  EmployeeInput,
} from '../domain/people-directory.models';
import { PeopleDirectoryRepository } from '../domain/people-directory.repository';

const PATHS: Record<DirectoryKind, string> = {
  department: 'departments',
  designation: 'designations',
  employee: 'employees',
};

@Injectable()
export class ApiPeopleDirectoryRepository extends PeopleDirectoryRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private get base(): string {
    return `${this.config.config.api.baseUrl}/hr`;
  }

  private page<T>(kind: DirectoryKind, query: PageQuery): Observable<Page<T>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.q.trim()) params = params.set('q', query.q.trim());
    return this.http.get<Page<T>>(`${this.base}/${PATHS[kind]}`, { params });
  }

  departments(query: PageQuery): Observable<Page<DepartmentEntry>> {
    return this.page('department', query);
  }

  designations(query: PageQuery): Observable<Page<DesignationEntry>> {
    return this.page('designation', query);
  }

  employees(query: PageQuery): Observable<Page<EmployeeEntry>> {
    return this.page('employee', query);
  }

  departmentOptions(): Observable<DirectoryOption[]> {
    return this.http.get<DirectoryOption[]>(`${this.base}/departments/options`);
  }

  designationOptions(): Observable<DirectoryOption[]> {
    return this.http.get<DirectoryOption[]>(`${this.base}/designations/options`);
  }

  nextCode(kind: DirectoryKind): Observable<string> {
    return this.http
      .get<{ code: string }>(`${this.base}/${PATHS[kind]}/next-code`)
      .pipe(map((r) => r.code));
  }

  createDepartment(input: DepartmentInput): Observable<DepartmentEntry> {
    return this.http.post<DepartmentEntry>(`${this.base}/departments`, input);
  }

  createDesignation(input: DesignationInput): Observable<DesignationEntry> {
    return this.http.post<DesignationEntry>(`${this.base}/designations`, input);
  }

  createEmployee(input: EmployeeInput): Observable<EmployeeEntry> {
    return this.http.post<EmployeeEntry>(`${this.base}/employees`, input);
  }
}
