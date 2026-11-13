/** Stage keys come from the workflow config, so they are plain strings, not a fixed union. */
export type StageKey = string;

/** Automatic signature: who did it, in what role, and when (UTC ISO date-time). */
export interface Stamp {
  userId: string;
  name: string;
  role: string;
  at: string;
}

export interface Contact {
  name: string;
  phone: string;
  email: string;
}

export interface PendingBill {
  ref: string;
  amount: number | null;
}

export interface HandedDocument {
  name: string;
  /** ISO date. */
  receivedOn: string;
}

export interface ReturnedItem {
  name: string;
  returnedOn: string;
}

export interface Filing {
  itFiledDate: string;
  ackNo: string;
  udin: string;
  udinDate: string;
  itrVSentDate: string;
  itVerified: 'yes' | 'no' | '';
  itVerifiedMode: string;
  itVerifiedDate: string;
}

export interface Tax {
  kind: 'payable' | 'refund' | '';
  amount: number | null;
  fy: string;
  paymentDate: string;
  paymentMode: string;
  receiptDate: string;
  receiptMode: string;
}

/** One completion step (work finished / finalized / documented) with its automatic stamp. */
export interface CompletionStep {
  stamp: Stamp | null;
  comments: string;
}

export interface ChecklistItem {
  label: string;
  done: boolean;
}

export interface Completion {
  finished: CompletionStep;
  finalized: CompletionStep;
  documented: CompletionStep;
  checklist: ChecklistItem[];
  folderLocations: string[];
}

export type OfficeDecision = 'OK' | 'Rework' | 'Reject' | '';

export interface OfficeApproval {
  decision: OfficeDecision;
  stamp: Stamp | null;
  comments: string;
}

export interface Delivery {
  mode: string;
  items: string;
  date: string;
  receiverName: string;
  receiverPhone: string;
  invoiceNo: string;
  invoiceAmount: number | null;
  receiptAmount: number | null;
  receiptDate: string;
  receiptMode: string;
}

export type HistoryKind = 'create' | 'edit' | 'action' | 'reassign' | 'retarget' | 'credential';

export interface HistoryChange {
  label: string;
  from: string;
  to: string;
}

/** Append-only. Entries are never edited or removed; corrections are new entries. */
export interface HistoryEntry {
  id: string;
  at: string;
  userId: string;
  userName: string;
  role: string;
  kind: HistoryKind;
  label: string;
  fromStage: StageKey | null;
  toStage: StageKey | null;
  comment: string;
  changes: HistoryChange[];
}

export interface WorkSheet {
  id: string;
  /** Auto number, e.g. WS-2026-0001. */
  workNo: string;
  stage: StageKey;
  createdById: string;

  // Header
  receivedDate: string;
  assignDate: string;
  targetDate: string;
  reference: string;
  mobile: string;
  others: string;
  contacts: Contact[];

  // Assignment (filled by the stage actions, never typed in)
  assignedById: string | null;
  assignedOpsId: string | null;
  assignedTlId: string | null;
  assignedTmId: string | null;

  // Client (credentials stay on the client master, not here)
  clientId: string;

  // Work
  workTypeKey: string;
  period: string;
  score: number | null;
  requirements: string[];
  pendingBills: PendingBill[];
  documents: HandedDocument[];
  returned: ReturnedItem[];

  filing: Filing;
  tax: Tax;
  completion: Completion;
  officeApproval: OfficeApproval;
  delivery: Delivery;

  /** `clientId|workTypeKey|period` of recurring sheets, so a period is generated only once. */
  recurringKey: string;
  /** Number of times the sheet was sent back (rework or reject). */
  reworkCount: number;
  closedAt: string;
  history: HistoryEntry[];
}

export interface WorkType {
  key: string;
  label: string;
  /** How the period/year of this kind of work is written. */
  periodKind: 'month' | 'quarter' | 'fy' | 'text';
}

export interface ActionPayload {
  comment?: string;
  targetDate?: string;
  assigneeId?: string;
}

export type AssigneeSlot = 'ops' | 'tl' | 'tm';

export interface ReassignPayload {
  slot: AssigneeSlot;
  assigneeId: string;
  reason: string;
}

export interface RetargetPayload {
  targetDate: string;
  reason: string;
}

/** The slice of the signed-in user the engine needs. */
export interface Actor {
  id: string;
  name: string;
  role: string;
  roleId: string;
  seesAll: boolean;
  permissions: string[];
  /** The user plus everyone who reports to them. */
  subtree: Set<string>;
}
