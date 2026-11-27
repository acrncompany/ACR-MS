import {
  OrganisationTypeAuditSpec,
  OrganisationTypePage,
  OrganisationTypeQuery,
  OrganisationTypeRecord,
} from './organisation-type.records.js';

export abstract class OrganisationTypesRepository {
  abstract list(query: OrganisationTypeQuery): Promise<OrganisationTypePage>;
  /** Preview of the code the next create will get (reserves nothing). */
  abstract peekNextCode(): Promise<string>;
  /**
   * Issues the code and inserts the row in ONE transaction together with the audit row.
   * `key` is the stable slug the client master refers to.
   */
  abstract create(
    name: string,
    key: string,
    audit: OrganisationTypeAuditSpec,
  ): Promise<OrganisationTypeRecord>;
  /**
   * Renames the type (label only: code and key never change) and writes the audit row in the same
   * transaction. Returns null when it does not exist.
   */
  abstract rename(
    id: string,
    name: string,
    audit: OrganisationTypeAuditSpec,
  ): Promise<OrganisationTypeRecord | null>;
}
