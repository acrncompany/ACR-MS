import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../core/config/app-config.service';
import {
  Client,
  CredentialAuditEntry,
  CredentialKey,
  RecurringRule,
} from '../domain/client.models';
import { ClientRepository } from '../domain/client.repository';

/** Real implementation. The endpoints are placeholders until the backend module exists. */
@Injectable()
export class ApiClientRepository extends ClientRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private get base(): string {
    return `${this.config.config.api.baseUrl}/clients`;
  }

  list(): Observable<Client[]> {
    return this.http.get<Client[]>(this.base);
  }

  revealCredential(
    clientId: string,
    key: CredentialKey,
    worksheetId: string | null,
  ): Observable<string> {
    return this.http.post<string>(`${this.base}/${clientId}/credentials/reveal`, {
      key,
      worksheetId,
    });
  }

  updateCredential(
    clientId: string,
    key: CredentialKey,
    value: string,
    worksheetId: string | null,
  ): Observable<void> {
    return this.http.put<void>(`${this.base}/${clientId}/credentials`, { key, value, worksheetId });
  }

  updateRecurring(clientId: string, rules: RecurringRule[]): Observable<void> {
    return this.http.put<void>(`${this.base}/${clientId}/recurring`, { rules });
  }

  credentialAudit(clientId: string): Observable<CredentialAuditEntry[]> {
    return this.http.get<CredentialAuditEntry[]>(`${this.base}/${clientId}/credentials/audit`);
  }
}
