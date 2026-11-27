/** One row of the organisation type master (the client form's "Organisation type" dropdown). */
export interface OrganisationTypeEntry {
  id: string;
  /** ORG-0001... Issued by the server once, never changes, never typed in. */
  code: string;
  name: string;
}

/** Only the name: the server issues the code. */
export interface OrganisationTypeInput {
  name: string;
}
