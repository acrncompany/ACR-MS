/**
 * THE permission catalogue: the single source of truth for permission keys ("module.action").
 * The dev seed writes it to the global `permissions` table, and a test fails when the frontend
 * uses a key that is not listed here. Add a key here first, then use it anywhere else.
 */

/** Modules that use the four standard actions (the frontend's permission matrix). */
export const STANDARD_MODULES = [
  'dashboard',
  'organization',
  'users',
  'roles',
  'clients',
  'hr',
] as const;

export const STANDARD_ACTIONS = ['view', 'create', 'edit', 'approve'] as const;

/** Stage actions of the Work Sheet workflow. Each one is its own permission. */
export const WORKSHEET_ACTIONS = [
  'view',
  'create',
  'assign',
  'plan',
  'allocate',
  'execute',
  'finalize',
  'document',
  'approve',
  'deliver',
  'reassign',
  'retarget',
] as const;

/**
 * Extra actions of specific modules, on top of the four standard ones. Clients and staff (the
 * `users` module) may be deactivated; revealing a client portal credential is its own permission.
 */
export const MODULE_EXTRA_ACTIONS = {
  clients: ['deactivate', 'reveal_credentials'],
  users: ['deactivate'],
} as const;

export interface PermissionDef {
  key: string;
  module: string;
  description: string;
}

const MODULE_LABELS: Record<(typeof STANDARD_MODULES)[number], string> = {
  dashboard: 'the dashboard',
  organization: 'the organization (companies, branches, departments, positions)',
  users: 'users',
  roles: 'roles and permissions',
  clients: 'clients',
  hr: 'HR (employees, attendance, leave)',
};

const ACTION_VERBS: Record<(typeof STANDARD_ACTIONS)[number], string> = {
  view: 'View',
  create: 'Create in',
  edit: 'Edit',
  approve: 'Approve in',
};

const EXTRA_DESCRIPTIONS: Record<string, string> = {
  'clients.deactivate': 'Deactivate or reactivate a client',
  'clients.reveal_credentials': 'Reveal a client portal credential (audited)',
  'users.deactivate': 'Deactivate or reactivate a staff member',
};

const WORKSHEET_DESCRIPTIONS: Record<(typeof WORKSHEET_ACTIONS)[number], string> = {
  view: 'Open the work sheet module (rows still follow the hierarchy)',
  create: 'Intake: create and submit a work sheet',
  assign: 'Approve and assign: set the target date, assign to an Operations Manager',
  plan: 'Planning: assign a Team Lead',
  allocate: 'Allocation: assign a Team Member',
  execute: 'Execution: do the work, fill filing details, mark finished',
  finalize: 'Review: finalize or send back for rework',
  document: 'Documentation checklist and folder locations',
  approve: 'Office approval: OK, rework or reject',
  deliver: 'Delivery, invoice, fee receipt and closing',
  reassign: 'Change an assignee at any stage',
  retarget: 'Change the target date at any stage',
};

export const PERMISSIONS: readonly PermissionDef[] = [
  ...STANDARD_MODULES.flatMap((module) =>
    STANDARD_ACTIONS.map((action) => ({
      key: `${module}.${action}`,
      module,
      description: `${ACTION_VERBS[action]} ${MODULE_LABELS[module]}`,
    })),
  ),
  ...Object.entries(MODULE_EXTRA_ACTIONS).flatMap(([module, actions]) =>
    actions.map((action) => ({
      key: `${module}.${action}`,
      module,
      description: EXTRA_DESCRIPTIONS[`${module}.${action}`],
    })),
  ),
  ...WORKSHEET_ACTIONS.map((action) => ({
    key: `worksheet.${action}`,
    module: 'worksheet',
    description: WORKSHEET_DESCRIPTIONS[action],
  })),
  // Backend-only keys (no frontend matrix row yet).
  { key: 'position.move', module: 'organization', description: 'Move people between positions' },
  { key: 'audit.view', module: 'audit', description: 'View the audit log' },
  { key: 'settings.view', module: 'settings', description: 'View tenant settings' },
  { key: 'settings.edit', module: 'settings', description: 'Change tenant settings' },
];

export const PERMISSION_KEYS: ReadonlySet<string> = new Set(PERMISSIONS.map((p) => p.key));
