import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
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
  AdditionalDocument,
  DocumentInfo,
  DocumentKind,
  PersonDetail,
  PersonEntry,
  PersonInput,
  PersonKind,
} from '../domain/people-directory.models';
import { PeopleDirectoryRepository } from '../domain/people-directory.repository';

const PATHS: Record<DirectoryKind, string> = {
  department: 'departments',
  designation: 'designations',
  employee: 'employees',
  article: 'articles',
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

  people(kind: PersonKind, query: PageQuery): Observable<Page<PersonEntry>> {
    return this.page(kind, query);
  }

  person(kind: PersonKind, id: string): Observable<PersonDetail> {
    return this.http.get<PersonDetail>(`${this.base}/${PATHS[kind]}/${id}`);
  }

  departmentOptions(): Observable<DirectoryOption[]> {
    return this.http.get<DirectoryOption[]>(`${this.base}/departments/options`);
  }

  designationOptions(): Observable<DirectoryOption[]> {
    return this.http.get<DirectoryOption[]>(`${this.base}/designations/options`);
  }

  employeeOptions(): Observable<DirectoryOption[]> {
    return this.http.get<DirectoryOption[]>(`${this.base}/employees/options`);
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

  createPerson(kind: PersonKind, input: PersonInput): Observable<PersonDetail> {
    return this.http.post<PersonDetail>(`${this.base}/${PATHS[kind]}`, input);
  }

  updatePerson(kind: PersonKind, id: string, input: PersonInput): Observable<PersonDetail> {
    return this.http.put<PersonDetail>(`${this.base}/${PATHS[kind]}/${id}`, input);
  }

  deletePerson(kind: PersonKind, id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${PATHS[kind]}/${id}`);
  }

  uploadDocument(
    kind: PersonKind,
    id: string,
    document: DocumentKind,
    file: File,
  ): Observable<DocumentInfo> {
    // The file is the raw request body; its original name travels in the query string.
    return this.http.post<DocumentInfo>(
      `${this.base}/${PATHS[kind]}/${id}/documents/${document}`,
      file,
      {
        params: new HttpParams().set('fileName', file.name),
        headers: new HttpHeaders({ 'Content-Type': 'application/octet-stream' }),
      },
    );
  }

  document(kind: PersonKind, id: string, document: DocumentKind): Observable<Blob> {
    return this.http.get(`${this.base}/${PATHS[kind]}/${id}/documents/${document}`, {
      responseType: 'blob',
    });
  }

  uploadAdditionalDocument(
    kind: PersonKind,
    id: string,
    file: File,
    title: string,
  ): Observable<AdditionalDocument> {
    let params = new HttpParams().set('fileName', file.name);
    if (title.trim()) params = params.set('title', title.trim());
    return this.http.post<AdditionalDocument>(
      `${this.base}/${PATHS[kind]}/${id}/additional-documents`,
      file,
      { params, headers: new HttpHeaders({ 'Content-Type': 'application/octet-stream' }) },
    );
  }

  additionalDocument(kind: PersonKind, id: string, documentId: string): Observable<Blob> {
    return this.http.get(`${this.base}/${PATHS[kind]}/${id}/additional-documents/${documentId}`, {
      responseType: 'blob',
    });
  }
}
