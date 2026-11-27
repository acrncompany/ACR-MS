export type KycStatus = 'done' | 'pending';

/** A director, partner or proprietor of the client, with KYC status. */
export interface Director {
  /** Stable id of the row (not the DIN; a proprietor or partner may have none). */
  id: string;
  name: string;
  /** Director Identification Number: 8 digits; empty for proprietors and most partners. */
  din: string;
  phone: string;
  email: string;
  kycStatus: KycStatus;
}

export interface OrganisationType {
  key: string;
  label: string;
}

/**
 * A law / compliance the client is subject to. Only the selection is stored for now.
 * LATER: each law will carry a recurring due-date schedule (for example GSTR-3B on the 20th of
 * every month), which will generate reminders and work sheets. Keys are kept as the CEO's
 * short forms until he confirms the final list.
 */
export interface ApplicableLaw {
  key: string;
  label: string;
}

export interface TeamOption {
  id: string;
  name: string;
}

export interface KycStatusOption {
  key: KycStatus;
  label: string;
}

/** Data-driven dropdown and checklist values; the backend will serve them from master tables. */
export interface ClientReferenceData {
  organisationTypes: OrganisationType[];
  laws: ApplicableLaw[];
  kycStatuses: KycStatusOption[];
}

export type RecurringFrequency = 'monthly' | 'quarterly';

/** Work of this type is generated automatically for the client once per period. */
export interface RecurringRule {
  workTypeKey: string;
  frequency: RecurringFrequency;
}

/**
 * Portal credential fields. Secrets belong to the CLIENT (not to any work sheet) so recurring
 * sheets never duplicate them. They are never part of `Client`; they are read one at a time
 * through `ClientRepository.revealCredential`, which is permission-checked and audited.
 */
export type CredentialKey =
  | 'incomeTax.pan'
  | 'incomeTax.password'
  | 'incomeTax.dob'
  | 'mca.id'
  | 'mca.password'
  | 'gst.id'
  | 'gst.password'
  | 'others.id'
  | 'pfEsi.id'
  | 'pfEsi.password'
  | 'others.id'
  | 'others.password';

export interface CredentialField {
  key: CredentialKey;
  label: string;
  group: 'MCA' | 'Income Tax' | 'GST / KVAT' | 'PF / ESI' | 'Others';
  /** Date of birth is entered with a date picker; everything else is text. */
  kind: 'text' | 'date';
}

export const CREDENTIAL_FIELDS: readonly CredentialField[] = [
  { key: 'incomeTax.pan', label: 'PAN', group: 'Income Tax', kind: 'text' },
  { key: 'incomeTax.password', label: 'Password', group: 'Income Tax', kind: 'text' },
  { key: 'incomeTax.dob', label: 'Date of birth', group: 'Income Tax', kind: 'date' },
  { key: 'mca.id', label: 'User ID', group: 'MCA', kind: 'text' },
  { key: 'mca.password', label: 'Password', group: 'MCA', kind: 'text' },
  { key: 'gst.id', label: 'GSTIN / TIN', group: 'GST / KVAT', kind: 'text' },
  { key: 'gst.password', label: 'Password', group: 'GST / KVAT', kind: 'text' },
  { key: 'pfEsi.id', label: 'User ID', group: 'PF / ESI', kind: 'text' },
  { key: 'pfEsi.password', label: 'Password', group: 'PF / ESI', kind: 'text' },
  { key: 'others.id', label: 'ID', group: 'Others', kind: 'text' },
  { key: 'others.password', label: 'Password', group: 'Others', kind: 'text' },
];

export interface CredentialAuditEntry {
  id: string;
  at: string;
  clientId: string;
  key: CredentialKey;
  action: 'revealed' | 'updated' | 'cleared' | 'denied' | 'blocked';
  userId: string;
  userName: string;
  /** The work sheet the secret was opened from, if any. */
  worksheetId: string | null;
}

/** What the form edits. `clientCode` is issued once by the repository and is never input. */
export interface ClientInput {
  name: string;
  address: string;
  city: string;
  email: string;
  phone: string;
  /** Key of an `OrganisationType` from the reference data. */
  organisationType: string;
  /** Company Identification Number, LLPIN or Firm Registration Number. */
  cinFrn: string;
  /** ISO date (YYYY-MM-DD), UTC. */
  incorporationDate: string;
  /** Permanent Account Number, e.g. AABCK4521M. */
  pan: string;
  /** 15-character GSTIN; empty for clients not registered under GST. */
  gstin: string;
  directors: Director[];
  /** Keys of `ApplicableLaw`. */
  lawKeys: string[];
  previousAuditor: string;
  services: string[];
  /** The people on the client's assigned team. */
  teamIds: string[];
}

export interface Client extends ClientInput {
  id: string;
  /** CLI-0001... Issued once at creation, never changed, never reused. Not editable. */
  clientCode: string;
  /** Display label of `organisationType` (the backend joins it from the master table). */
  organisationTypeLabel: string;
  /** Deactivated clients stay in history but are not offered for new work sheets. */
  active: boolean;
  /** Once true the client can only be deactivated, never deleted. */
  hasWorksheets: boolean;
  recurring: RecurringRule[];
  /** Names of the people on the client's assigned team. */
  team: string[];
  /** Which credential fields have a value stored (never the values themselves). */
  credentialsSet: CredentialKey[];
}
