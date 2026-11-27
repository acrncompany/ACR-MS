import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AppConfigService } from '../../../core/config/app-config.service';
import { Page, PageQuery } from '../../../core/http/page';
import { OrganisationTypeEntry, OrganisationTypeInput } from '../domain/organisation-type.models';
import { OrganisationTypeRepository } from '../domain/organisation-type.repository';

@Injectable()
export class ApiOrganisationTypeRepository extends OrganisationTypeRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private get base(): string {
    return `${this.config.config.api.baseUrl}/organisation-types`;
  }

  list(query: PageQuery): Observable<Page<OrganisationTypeEntry>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.q.trim()) params = params.set('q', query.q.trim());
    return this.http.get<Page<OrganisationTypeEntry>>(this.base, { params });
  }

  nextCode(): Observable<string> {
    return this.http.get<{ code: string }>(`${this.base}/next-code`).pipe(map((r) => r.code));
  }

  create(input: OrganisationTypeInput): Observable<OrganisationTypeEntry> {
    return this.http.post<OrganisationTypeEntry>(this.base, { name: input.name });
  }

  update(id: string, input: OrganisationTypeInput): Observable<OrganisationTypeEntry> {
    return this.http.patch<OrganisationTypeEntry>(`${this.base}/${id}`, { name: input.name });
  }
}
