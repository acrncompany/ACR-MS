import {
  ClientAuditSpec,
  ClientPage,
  ClientQuery,
  ClientRecord,
  ClientWrite,
  ReferenceData,
} from './client.records.js';

export abstract class ClientsRepository {
  abstract list(query: ClientQuery): Promise<ClientPage>;
  /** `branchIds` null = any branch. */
  abstract findById(id: string, branchIds: string[] | null): Promise<ClientRecord | null>;
  abstract referenceData(): Promise<ReferenceData>;
  /** Preview of the next client code. Reserves nothing; `create` issues the real one. */
  abstract peekNextCode(): Promise<string>;
  /**
   * Issues the client code and inserts the client, directors, laws and team in ONE transaction
   * together with the audit row.
   */
  abstract create(
    input: ClientWrite,
    branchId: string,
    audit: ClientAuditSpec,
  ): Promise<ClientRecord>;
  /** Replaces the fields, directors, laws and team in one transaction with the audit row. */
  abstract update(id: string, input: ClientWrite, audit: ClientAuditSpec): Promise<ClientRecord>;
  abstract setActive(id: string, active: boolean, audit: ClientAuditSpec): Promise<void>;
  /** Clients a person created, edited or is assigned to (part of the "has history" check). */
  abstract countTouchedBy(userId: string): Promise<number>;
}
