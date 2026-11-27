import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AppConfigService } from '../../../core/config/app-config.service';
import { Page } from '../../../core/http/page';
import { AssignableStaff, NewStaffInput, StaffInput, StaffMember } from '../domain/admin.models';
import { CreatedStaff, StaffQuery, StaffRepository } from '../domain/staff.repository';

@Injectable()
export class ApiStaffRepository extends StaffRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private get base(): string {
    return `${this.config.config.api.baseUrl}/users`;
  }

  list(query: StaffQuery): Observable<Page<StaffMember>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.q.trim()) params = params.set('q', query.q.trim());
    if (query.active !== null) params = params.set('active', String(query.active));
    return this.http.get<Page<StaffMember>>(this.base, { params });
  }

  get(id: string): Observable<StaffMember> {
    return this.http.get<StaffMember>(`${this.base}/${id}`);
  }

  assignable(): Observable<AssignableStaff[]> {
    return this.http
      .get<{ items: AssignableStaff[] }>(`${this.base}/assignable`)
      .pipe(map((r) => r.items));
  }

  creatablePositionIds(): Observable<string[]> {
    return this.http
      .get<{ positionIds: string[] }>(`${this.base}/creatable-positions`)
      .pipe(map((r) => r.positionIds));
  }

  nextCode(): Observable<string> {
    return this.http.get<{ code: string }>(`${this.base}/next-code`).pipe(map((r) => r.code));
  }

  create(input: NewStaffInput): Observable<CreatedStaff> {
    return this.http.post<CreatedStaff>(this.base, input);
  }

  update(id: string, input: Partial<StaffInput>): Observable<StaffMember> {
    return this.http.patch<StaffMember>(`${this.base}/${id}`, input);
  }

  setActive(id: string, active: boolean): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/${active ? 'reactivate' : 'deactivate'}`, null);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
