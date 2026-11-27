export type KycStatusValue = 'done' | 'pending';

export interface DirectorRecord {
  id: string;
  name: string;
  din: string | null;
  phone: string | null;
  email: string | null;
  kycStatus: KycStatusValue;
}

/** A client as the API returns it. Portal credentials are NEVER part of it. */
export interface ClientRecord {
  id: string;
  /** CLI-0001... Permanent, issued once, never reused. */
  clientCode: string;
  branchId: string;
  name: string;
  address: string;
  city: string | null;
  email: string | null;
  phone: string | null;
  /** Key of the organisation type (e.g. "pvt-co"). */
  organisationType: string;
  organisationTypeLabel: string;
  cinFrn: string | null;
  /** ISO date YYYY-MM-DD. */
  incorporationDate: string | null;
  pan: string;
  gstin: string | null;
  previousAuditor: string | null;
  active: boolean;
  directors: DirectorRecord[];
  lawKeys: string[];
  teamIds: string[];
  team: string[];
}

export interface ClientDetail extends ClientRecord {
  /** Which credential fields hold a value (never the values). */
  credentialsSet: string[];
}

export interface ClientWrite {
  name: string;
  address: string;
  city: string | null;
  email: string | null;
  phone: string | null;
  organisationType: string;
  cinFrn: string | null;
  incorporationDate: string | null;
  pan: string;
  gstin: string | null;
  previousAuditor: string | null;
  directors: Omit<DirectorRecord, 'id'>[];
  lawKeys: string[];
  teamIds: string[];
}

export interface ClientQuery {
  q: string | null;
  active: boolean | null;
  /** null = every branch the tenant has. */
  branchIds: string[] | null;
  page: number;
  pageSize: number;
}

export interface ClientPage {
  items: ClientRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReferenceData {
  organisationTypes: { key: string; label: string }[];
  laws: { key: string; label: string }[];
  kycStatuses: { key: KycStatusValue; label: string }[];
}

export interface ClientAuditSpec {
  action: string;
  userId: string;
  changes: Record<string, unknown>;
}
