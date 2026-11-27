import { Observable } from 'rxjs';
import { Page, PageQuery } from '../../../core/http/page';
import {
  Client,
  ClientInput,
  ClientReferenceData,
  CredentialAuditEntry,
  CredentialKey,
  RecurringRule,
  TeamOption,
} from './client.models';

export interface ClientQuery extends PageQuery {
  /** null = both active and inactive. */
  active: boolean | null;
}

export abstract class ClientRepository {
  /** One page of clients. Search (name, code, PAN, GSTIN) and paging happen on the server. */
  abstract list(query: ClientQuery): Observable<Page<Client>>;
  /**
   * Every client the caller may see (pages through the list, capped). For pickers such as the
   * client dropdown of a work sheet; lists use `list` with server-side paging instead.
   */
  abstract listAll(): Observable<Client[]>;
  /** Errors with a 404 when the client does not exist or is outside the caller's branches. */
  abstract get(id: string): Observable<Client>;
  abstract referenceData(): Observable<ClientReferenceData>;
  /** Preview of the code the next client gets (reserves nothing; the server issues it on save). */
  abstract nextCode(): Observable<string>;
  /** Active staff who can be put on a client's assigned team (deactivated people are left out). */
  abstract teamOptions(): Observable<TeamOption[]>;

  /**
   * The server issues `clientCode` from a per-tenant sequence in the same transaction as the
   * insert. It is never part of the input and never changes afterwards.
   */
  abstract create(input: ClientInput): Observable<Client>;
  abstract update(id: string, input: ClientInput): Observable<Client>;
  /**
   * Deactivate or reactivate. Clients are never hard-deleted, so the UI offers no delete at all.
   */
  abstract setActive(id: string, active: boolean): Observable<void>;

  /**
   * Returns one stored secret in clear text. The server checks `clients.reveal_credentials`,
   * re-checks the user's CURRENT password, rate limits, and writes the audit entry in the same
   * transaction; the UI never sees a secret it did not ask for.
   */
  abstract revealCredential(
    clientId: string,
    key: CredentialKey,
    password: string,
    worksheetId: string | null,
  ): Observable<string>;

  /** Write-only: sets (or, with an empty value, clears) a secret of the client. */
  abstract updateCredential(
    clientId: string,
    key: CredentialKey,
    value: string,
    worksheetId: string | null,
  ): Observable<void>;

  /** Not available against the backend yet (recurring work belongs to the work sheet module). */
  abstract updateRecurring(clientId: string, rules: RecurringRule[]): Observable<void>;

  abstract credentialAudit(clientId: string): Observable<CredentialAuditEntry[]>;
}
