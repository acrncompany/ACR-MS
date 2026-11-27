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
  | 'retarget';

/** Extra per-module actions beyond the four standard ones (see the backend catalogue). */
export type ExtraAction = 'deactivate' | 'reveal_credentials';

export type Action = StandardAction | WorksheetAction | ExtraAction;

export interface ModuleExtraActionDef {
  module: string;
  action: ExtraAction;
  label: string;
  hint: string;
}

/** Extra rows of the permission matrix: deactivate people and clients, reveal portal secrets. */
export const MODULE_EXTRA_ACTIONS: readonly ModuleExtraActionDef[] = [
  {
    module: 'users',
    action: 'deactivate',
    label: 'Deactivate staff',
    hint: 'Deactivate or reactivate a staff member',
  },
  {
    module: 'clients',
    action: 'deactivate',
    label: 'Deactivate clients',
    hint: 'Deactivate or reactivate a client',
  },
  {
    module: 'clients',
    action: 'reveal_credentials',
    label: 'Reveal client credentials',
    hint: 'Unmask portal passwords (audited)',
  },
];

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
];

export interface ModuleDef {
  key: string;
  label: string;
  /** Shown in its own matrix section instead of the standard four columns. */
  separate?: boolean;
}

/** Modules the permission matrix covers. Sidebar items point at these keys. */
export const MODULES: ModuleDef[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'organization', label: 'Organization' },
  { key: 'users', label: 'Users' },
  { key: 'roles', label: 'Roles & permissions' },
  { key: 'clients', label: 'Clients' },
  { key: 'hr', label: 'HR' },
  { key: 'worksheet', label: 'Work sheets', separate: true },
];
