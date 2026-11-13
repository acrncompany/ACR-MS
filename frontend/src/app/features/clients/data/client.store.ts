import { Injectable, signal } from '@angular/core';
import { CredentialAuditEntry, CredentialKey, RecurringRule } from '../domain/client.models';
import { CLIENT_PROFILES } from './client.profiles';
import { CLIENT_SEEDS, buildGstin } from './client.seed';

/**
 * Mock-only, in-memory client master shared by every route that provides the mock repository.
 * Secrets live here only because there is no backend yet; they are never persisted to storage
 * and are handed out one at a time through the (audited) repository.
 */
@Injectable({ providedIn: 'root' })
export class ClientStore {
  readonly recurring = signal<Record<string, RecurringRule[]>>(
    Object.fromEntries(CLIENT_SEEDS.map((c) => [c.id, [...CLIENT_PROFILES[c.id].recurring]])),
  );
  readonly secrets = signal<Record<string, Partial<Record<CredentialKey, string>>>>(
    Object.fromEntries(
      CLIENT_SEEDS.map((c) => {
        const credentials = { ...CLIENT_PROFILES[c.id].credentials };
        // The GST login id is the client's own GSTIN (the profile marks it with a placeholder).
        if (credentials['gst.id']) credentials['gst.id'] = buildGstin(c.stateCode, c.pan);
        return [c.id, credentials];
      }),
    ),
  );
  readonly audit = signal<CredentialAuditEntry[]>([]);
}
