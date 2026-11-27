import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce, throwError } from 'rxjs';
import { AppConfigService } from '../../../core/config/app-config.service';
import { Page } from '../../../core/http/page';
import {
  Client,
  ClientInput,
  ClientReferenceData,
  CredentialAuditEntry,
  CredentialKey,
  Director,
  TeamOption,
} from '../domain/client.models';
import { ClientQuery, ClientRepository } from '../domain/client.repository';

/** What the API returns for a client (nullable text fields; no work-sheet-module fields). */
interface ApiClient {
  id: string;
  clientCode: string;
  branchId: string;
  name: string;
  address: string;
  city: string | null;
  email: string | null;
  phone: string | null;
  organisationType: string;
  organisationTypeLabel: string;
  cinFrn: string | null;
  incorporationDate: string | null;
  pan: string;
  gstin: string | null;
  previousAuditor: string | null;
  active: boolean;
  directors: {
    id: string;
    name: string;
    din: string | null;
    phone: string | null;
    email: string | null;
    kycStatus: 'done' | 'pending';
  }[];
  lawKeys: string[];
  teamIds: string[];
  team: string[];
  credentialsSet?: CredentialKey[];
}

const text = (value: string | null): string => value ?? '';

/** The form works with plain strings; the API uses null for "empty". */
function toClient(c: ApiClient): Client {
  return {
    ...c,
    city: text(c.city),
    email: text(c.email),
    phone: text(c.phone),
    cinFrn: text(c.cinFrn),
    incorporationDate: text(c.incorporationDate),
    gstin: text(c.gstin),
    previousAuditor: text(c.previousAuditor),
    directors: c.directors.map<Director>((d) => ({
      ...d,
      din: text(d.din),
      phone: text(d.phone),
      email: text(d.email),
    })),
    credentialsSet: c.credentialsSet ?? [],
    // Not stored by the client master: services and recurring work belong to the work sheet module.
    services: [],
    recurring: [],
    hasWorksheets: false,
  };
}

/** Only the fields the API accepts (it rejects unknown keys such as clientCode or services). */
function toBody(input: ClientInput) {
  return {
    name: input.name,
    address: input.address,
    city: input.city,
    email: input.email,
    phone: input.phone,
    organisationType: input.organisationType,
    cinFrn: input.cinFrn,
    incorporationDate: input.incorporationDate,
    pan: input.pan,
    gstin: input.gstin,
    previousAuditor: input.previousAuditor,
    directors: input.directors.map(({ name, din, phone, email, kycStatus }) => ({
      name,
      din,
      phone,
      email,
      kycStatus,
    })),
    lawKeys: input.lawKeys,
    teamIds: input.teamIds,
  };
}

const PICKER_PAGE = 100;
const PICKER_MAX_PAGES = 5;

@Injectable()
export class ApiClientRepository extends ClientRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private get base(): string {
    return `${this.config.config.api.baseUrl}/clients`;
  }

  list(query: ClientQuery): Observable<Page<Client>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.q.trim()) params = params.set('q', query.q.trim());
    if (query.active !== null) params = params.set('active', String(query.active));
    return this.http
      .get<Page<ApiClient>>(this.base, { params })
      .pipe(map((p) => ({ ...p, items: p.items.map(toClient) })));
  }

  listAll(): Observable<Client[]> {
    const fetch = (page: number) => this.list({ q: '', page, pageSize: PICKER_PAGE, active: null });
    return fetch(1).pipe(
      expand((p) =>
        p.page * p.pageSize < p.total && p.page < PICKER_MAX_PAGES ? fetch(p.page + 1) : EMPTY,
      ),
      reduce<Page<Client>, Client[]>((all, p) => [...all, ...p.items], []),
    );
  }

  get(id: string): Observable<Client> {
    return this.http.get<ApiClient>(`${this.base}/${id}`).pipe(map(toClient));
  }

  nextCode(): Observable<string> {
    return this.http.get<{ code: string }>(`${this.base}/next-code`).pipe(map((r) => r.code));
  }

  referenceData(): Observable<ClientReferenceData> {
    return this.http.get<ClientReferenceData>(`${this.base}/reference-data`);
  }

  teamOptions(): Observable<TeamOption[]> {
    return this.http
      .get<{ items: TeamOption[] }>(`${this.base}/team-options`)
      .pipe(map((r) => r.items));
  }

  create(input: ClientInput): Observable<Client> {
    return this.http.post<ApiClient>(this.base, toBody(input)).pipe(map(toClient));
  }

  update(id: string, input: ClientInput): Observable<Client> {
    return this.http.put<ApiClient>(`${this.base}/${id}`, toBody(input)).pipe(map(toClient));
  }

  setActive(id: string, active: boolean): Observable<void> {
    return this.http.patch<void>(`${this.base}/${id}/active`, { active });
  }

  revealCredential(
    clientId: string,
    key: CredentialKey,
    password: string,
    worksheetId: string | null,
  ): Observable<string> {
    return this.http
      .post<{ value: string }>(`${this.base}/${clientId}/credentials/reveal`, {
        key,
        password,
        worksheetId,
      })
      .pipe(map((r) => r.value));
  }

  updateCredential(clientId: string, key: CredentialKey, value: string): Observable<void> {
    return this.http.put<void>(`${this.base}/${clientId}/credentials`, { key, value });
  }

  updateRecurring(): Observable<void> {
    return throwError(() => new Error('Recurring work is not available yet.'));
  }

  credentialAudit(clientId: string): Observable<CredentialAuditEntry[]> {
    return this.http
      .get<{
        items: (Omit<CredentialAuditEntry, 'clientId' | 'key'> & { key: CredentialKey | null })[];
      }>(`${this.base}/${clientId}/credentials/audit`)
      .pipe(
        map((r) =>
          r.items
            .filter((i) => i.key !== null)
            .map((i) => ({ ...i, clientId, key: i.key as CredentialKey })),
        ),
      );
  }
}
