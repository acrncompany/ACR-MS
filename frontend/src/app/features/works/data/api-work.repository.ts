import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AppConfigService } from '../../../core/config/app-config.service';
import { Page, PageQuery } from '../../../core/http/page';
import { WorkEntry, WorkInput } from '../domain/work.models';
import { WorkRepository } from '../domain/work.repository';

@Injectable()
export class ApiWorkRepository extends WorkRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private get base(): string {
    return `${this.config.config.api.baseUrl}/works`;
  }

  list(query: PageQuery): Observable<Page<WorkEntry>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.q.trim()) params = params.set('q', query.q.trim());
    return this.http.get<Page<WorkEntry>>(this.base, { params });
  }

  nextCode(): Observable<string> {
    return this.http.get<{ code: string }>(`${this.base}/next-code`).pipe(map((r) => r.code));
  }

  create(input: WorkInput): Observable<WorkEntry> {
    return this.http.post<WorkEntry>(this.base, { name: input.name });
  }

  update(id: string, input: WorkInput): Observable<WorkEntry> {
    return this.http.patch<WorkEntry>(`${this.base}/${id}`, { name: input.name });
  }
}
