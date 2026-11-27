export interface OrganisationTypeRecord {
  id: string;
  /** ORG-0001... Permanent, issued once, never reused. */
  code: string;
  /** The name users see. */
  name: string;
}

export interface OrganisationTypeQuery {
  q: string | null;
  page: number;
  pageSize: number;
}

export interface OrganisationTypePage {
  items: OrganisationTypeRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OrganisationTypeAuditSpec {
  action: string;
  userId: string;
  changes: Record<string, unknown>;
}
