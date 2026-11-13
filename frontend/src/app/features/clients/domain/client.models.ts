export type Constitution = 'Individual' | 'Firm' | 'Company';

export interface Principal {
  name: string;
  designation: 'Proprietor' | 'Partner' | 'Director' | 'Trustee';
  mobile: string;
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
  | 'gst.id'
  | 'gst.password'
  | 'others.id'
  | 'others.password';

export interface CredentialField {
  key: CredentialKey;
  label: string;
  group: 'Income Tax' | 'GST / KVAT' | 'Others';
  /** Date of birth is entered with a date picker; everything else is text. */
  kind: 'text' | 'date';
}

export const CREDENTIAL_FIELDS: readonly CredentialField[] = [
  { key: 'incomeTax.pan', label: 'PAN', group: 'Income Tax', kind: 'text' },
  { key: 'incomeTax.password', label: 'Password', group: 'Income Tax', kind: 'text' },
  { key: 'incomeTax.dob', label: 'Date of birth', group: 'Income Tax', kind: 'date' },
  { key: 'gst.id', label: 'GSTIN / TIN', group: 'GST / KVAT', kind: 'text' },
  { key: 'gst.password', label: 'Password', group: 'GST / KVAT', kind: 'text' },
  { key: 'others.id', label: 'ID', group: 'Others', kind: 'text' },
  { key: 'others.password', label: 'Password', group: 'Others', kind: 'text' },
];

export interface CredentialAuditEntry {
  id: string;
  at: string;
  clientId: string;
  key: CredentialKey;
  action: 'revealed' | 'updated';
  userId: string;
  userName: string;
  /** The work sheet the secret was opened from, if any. */
  worksheetId: string | null;
}

export interface Client {
  id: string;
  name: string;
  /** Permanent Account Number, e.g. AABCK4521M. */
  pan: string;
  /** 15-character GSTIN; empty for clients not registered under GST. */
  gstin: string;
  city: string;
  address: string;
  constitution: Constitution;
  /** Proprietor / partners / directors with their mobile numbers. */
  principals: Principal[];
  previousAuditor: string;
  services: string[];
  recurring: RecurringRule[];
  /** Names of the people on the client's assigned team. */
  team: string[];
  teamIds: string[];
  /** Which credential fields have a value stored (never the values themselves). */
  credentialsSet: CredentialKey[];
}
