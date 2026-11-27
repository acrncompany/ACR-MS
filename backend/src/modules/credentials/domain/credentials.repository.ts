import type { CredentialField } from './credential-fields.js';

export interface CredentialAuditSpec {
  action: string;
  userId: string;
  branchId: string | null;
  ip: string | null;
  changes: Record<string, unknown>;
}

export abstract class CredentialsRepository {
  /** Which fields have a value (never the values). */
  abstract listFields(clientId: string): Promise<CredentialField[]>;
  /** Encrypts and stores `value`, with the audit row in the same transaction. */
  abstract upsert(
    clientId: string,
    field: CredentialField,
    value: string,
    actorId: string,
    audit: CredentialAuditSpec,
  ): Promise<void>;
  /** Removes a stored value (returns false when none was stored), audited in the same transaction. */
  abstract remove(
    clientId: string,
    field: CredentialField,
    audit: CredentialAuditSpec,
  ): Promise<boolean>;
  /**
   * Reads and decrypts one value and writes the audit row in the SAME transaction: there is no
   * reveal without a record. Returns null when no value is stored.
   */
  abstract revealAudited(
    clientId: string,
    field: CredentialField,
    audit: CredentialAuditSpec,
  ): Promise<string | null>;
}
