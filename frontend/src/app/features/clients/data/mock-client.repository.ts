import { Injectable, inject } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { SessionService } from '../../../core/auth/session.service';
import { DirectoryStore } from '../../../core/mock/directory.store';
import {
  Client,
  CredentialAuditEntry,
  CredentialKey,
  RecurringRule,
} from '../domain/client.models';
import { ClientRepository } from '../domain/client.repository';
import { CLIENT_PROFILES } from './client.profiles';
import { CLIENT_SEEDS, buildGstin } from './client.seed';
import { ClientStore } from './client.store';

/** The client master is shared: every role allowed to open Clients sees all clients. */
@Injectable()
export class MockClientRepository extends ClientRepository {
  private readonly directory = inject(DirectoryStore);
  private readonly store = inject(ClientStore);
  private readonly session = inject(SessionService);

  list(): Observable<Client[]> {
    const secrets = this.store.secrets();
    const recurring = this.store.recurring();
    const clients = CLIENT_SEEDS.map<Client>((seed) => {
      const profile = CLIENT_PROFILES[seed.id];
      return {
        id: seed.id,
        name: seed.name,
        pan: seed.pan,
        gstin: buildGstin(seed.stateCode, seed.pan),
        city: seed.city,
        address: profile.address,
        constitution: profile.constitution,
        principals: profile.principals,
        previousAuditor: profile.previousAuditor,
        services: seed.services,
        recurring: recurring[seed.id] ?? [],
        teamIds: seed.teamIds,
        team: seed.teamIds.map((id) => this.directory.userName(id)),
        credentialsSet: Object.entries(secrets[seed.id] ?? {})
          .filter(([, value]) => !!value)
          .map(([key]) => key as CredentialKey),
      };
    });
    return of(clients).pipe(delay(150));
  }

  revealCredential(
    clientId: string,
    key: CredentialKey,
    worksheetId: string | null,
  ): Observable<string> {
    // UX-level check; the backend must enforce it.
    if (!this.session.can('worksheet.reveal')) {
      return throwError(() => new Error('You are not allowed to reveal client credentials.'));
    }
    const value = this.store.secrets()[clientId]?.[key];
    if (!value) return throwError(() => new Error('No value is stored for this field.'));
    this.log(clientId, key, 'revealed', worksheetId);
    return of(value);
  }

  updateCredential(
    clientId: string,
    key: CredentialKey,
    value: string,
    worksheetId: string | null,
  ): Observable<void> {
    if (!this.session.can('clients.edit')) {
      return throwError(() => new Error('You are not allowed to edit clients.'));
    }
    this.store.secrets.update((all) => ({
      ...all,
      [clientId]: { ...all[clientId], [key]: value },
    }));
    this.log(clientId, key, 'updated', worksheetId);
    return of(undefined);
  }

  updateRecurring(clientId: string, rules: RecurringRule[]): Observable<void> {
    if (!this.session.can('clients.edit')) {
      return throwError(() => new Error('You are not allowed to edit clients.'));
    }
    this.store.recurring.update((all) => ({ ...all, [clientId]: rules }));
    return of(undefined);
  }

  credentialAudit(clientId: string): Observable<CredentialAuditEntry[]> {
    return of(this.store.audit().filter((e) => e.clientId === clientId));
  }

  private log(
    clientId: string,
    key: CredentialKey,
    action: CredentialAuditEntry['action'],
    worksheetId: string | null,
  ): void {
    const user = this.session.user();
    const entry: CredentialAuditEntry = {
      id: `ca-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      clientId,
      key,
      action,
      userId: user?.id ?? '',
      userName: user?.name ?? '',
      worksheetId,
    };
    this.store.audit.update((list) => [entry, ...list]);
  }
}
