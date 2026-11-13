export type StandardAction = 'view' | 'create' | 'edit' | 'approve';
export const ACTIONS: readonly StandardAction[] = ['view', 'create', 'edit', 'approve'];

/** Stage actions of the Work Sheet workflow ("worksheet.<action>"). */
export type WorksheetAction =
  | StandardAction
  | 'assign'
  | 'plan'
  | 'allocate'
  | 'execute'
  | 'finalize'
  | 'document'
  | 'deliver'
  | 'reassign'
  | 'retarget'
  | 'reveal';

export type Action = StandardAction | WorksheetAction;

export interface WorksheetActionDef {
  action: WorksheetAction;
  label: string;
  hint: string;
}

/** Rows of the separate "Work Sheet actions" permission matrix (`edit` is not used by it). */
export const WORKSHEET_ACTIONS: readonly WorksheetActionDef[] = [
  {
    action: 'view',
    label: 'View work sheets',
    hint: 'Open the module (rows still follow the hierarchy)',
  },
  { action: 'create', label: 'Intake', hint: 'Create and submit a sheet' },
  {
    action: 'assign',
    label: 'Approve & assign',
    hint: 'Set target date, assign to Operations Manager',
  },
  { action: 'plan', label: 'Planning', hint: 'Assign a Team Lead' },
  { action: 'allocate', label: 'Allocation', hint: 'Assign a Team Member' },
  {
    action: 'execute',
    label: 'Execution',
    hint: 'Do the work, fill filing details, mark finished',
  },
  { action: 'finalize', label: 'Review', hint: 'Finalize or send back for rework' },
  {
    action: 'document',
    label: 'Documentation',
    hint: 'Documentation checklist and folder locations',
  },
  { action: 'approve', label: 'Office approval', hint: 'OK / Rework / Reject' },
  { action: 'deliver', label: 'Delivery & billing', hint: 'Delivery, invoice, fee receipt, close' },
  { action: 'reassign', label: 'Reassign', hint: 'Change an assignee at any stage' },
  { action: 'retarget', label: 'Re-target', hint: 'Change the target date at any stage' },
  {
    action: 'reveal',
    label: 'Reveal client credentials',
    hint: 'Unmask portal passwords (audited)',
  },
];

export interface ModuleDef {
  key: string;
  label: string;
  /** Shown in its own matrix section instead of the standard four columns. */
  separate?: boolean;
}

/** A department is a grouping label; reporting lines live on positions. */
export interface Department {
  id: string;
  name: string;
}

/** A position sits in a department, reports to another position and carries a role. */
export interface Position {
  id: string;
  title: string;
  departmentId: string;
  parentId: string | null;
  roleId: string;
}

/** A role is a set of permissions per module. Many positions may share one role. */
export interface Role {
  id: string;
  name: string;
  /** Sees every record regardless of the hierarchy (Board). */
  seesAll: boolean;
  /** Locked roles cannot be edited (stops the admin removing their own access). */
  locked: boolean;
  permissions: Record<string, Action[]>;
}

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  positionId: string;
  /** Reporting manager (a user). Visibility follows this chain. */
  managerId: string | null;
  active: boolean;
}

export interface DirectorySnapshot {
  departments: Department[];
  positions: Position[];
  roles: Role[];
  users: DirectoryUser[];
}
