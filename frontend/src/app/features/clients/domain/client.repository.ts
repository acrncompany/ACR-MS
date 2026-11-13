import { Observable } from 'rxjs';
import { Client, CredentialAuditEntry, CredentialKey, RecurringRule } from './client.models';

export abstract class ClientRepository {
  abstract list(): Observable<Client[]>;

  /**
   * Returns one stored secret in clear text. The backend must check `worksheet.reveal`, and
   * must write the audit entry itself; the UI never sees a secret it did not ask for.
   */
  abstract revealCredential(
    clientId: string,
    key: CredentialKey,
    worksheetId: string | null,
  ): Observable<string>;

  /** Sets a secret for the client; it applies to every work sheet of that client. */
  abstract updateCredential(
    clientId: string,
    key: CredentialKey,
    value: string,
    worksheetId: string | null,
  ): Observable<void>;

  abstract updateRecurring(clientId: string, rules: RecurringRule[]): Observable<void>;

  abstract credentialAudit(clientId: string): Observable<CredentialAuditEntry[]>;
}
