/**
 * Permission catalogue and the default ACR org chart (dev seed).
 * Hierarchy: Board > General Manager > { Operations Manager > Finance Officer (Team Lead) >
 * Finance Executive (Team Member); HR; BDE; Customer Care; Finance / Accounting }.
 */

const WORKSHEET_ACTIONS = [
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
  'reveal',
] as const;

export const PERMISSIONS: { key: string; module: string; description: string }[] = [
  ...WORKSHEET_ACTIONS.map((action) => ({
    key: `worksheet.${action}`,
    module: 'worksheet',
    description:
      action === 'reveal'
        ? 'Reveal a client portal credential (audited)'
        : `Work sheet stage action: ${action}`,
  })),
  { key: 'user.read', module: 'user', description: 'View users' },
  {
    key: 'user.create',
    module: 'user',
    description: 'Create users in the position directly below',
  },
  { key: 'user.update', module: 'user', description: 'Edit users below in the hierarchy' },
  {
    key: 'user.deactivate',
    module: 'user',
    description: 'Deactivate users below in the hierarchy',
  },
  { key: 'position.read', module: 'position', description: 'View positions' },
  { key: 'position.create', module: 'position', description: 'Create positions' },
  { key: 'position.update', module: 'position', description: 'Edit positions' },
  {
    key: 'position.move',
    module: 'position',
    description: 'Move people between positions (Board)',
  },
  { key: 'role.read', module: 'role', description: 'View roles and the permission matrix' },
  { key: 'role.manage', module: 'role', description: 'Create and edit roles and permissions' },
  { key: 'branch.read', module: 'branch', description: 'View branches' },
  { key: 'branch.manage', module: 'branch', description: 'Create and edit branches' },
  { key: 'company.read', module: 'company', description: 'View companies' },
  { key: 'company.manage', module: 'company', description: 'Create and edit companies' },
  { key: 'settings.read', module: 'settings', description: 'View tenant settings' },
  { key: 'settings.manage', module: 'settings', description: 'Change tenant settings' },
  { key: 'audit.read', module: 'audit', description: 'View the audit log' },
];

const any =
  (...keys: string[]) =>
  (key: string) =>
    keys.includes(key);

export const ROLES: {
  key: string;
  name: string;
  description: string;
  permissions: (key: string) => boolean;
}[] = [
  { key: 'board', name: 'Board', description: 'Full access', permissions: () => true },
  {
    key: 'general_manager',
    name: 'General Manager',
    description: 'Everything except moving people between positions',
    permissions: (key) => key !== 'position.move',
  },
  {
    key: 'operations_manager',
    name: 'Operations Manager',
    description: 'All operations work sheets',
    permissions: (key) =>
      key.startsWith('worksheet.') ||
      any(
        'user.read',
        'user.create',
        'user.update',
        'position.read',
        'branch.read',
        'company.read',
        'audit.read',
      )(key),
  },
  {
    key: 'finance_officer',
    name: 'Finance Officer (Team Lead)',
    description: 'Own and team work sheets',
    permissions: any(
      'worksheet.create',
      'worksheet.assign',
      'worksheet.plan',
      'worksheet.allocate',
      'worksheet.execute',
      'worksheet.finalize',
      'worksheet.document',
      'worksheet.approve',
      'worksheet.reassign',
      'worksheet.reveal',
      'user.read',
      'user.create',
      'position.read',
    ),
  },
  {
    key: 'finance_executive',
    name: 'Finance Executive (Team Member)',
    description: 'Executes assigned work sheets',
    permissions: any(
      'worksheet.plan',
      'worksheet.execute',
      'worksheet.document',
      'worksheet.reveal',
    ),
  },
  {
    key: 'hr',
    name: 'HR',
    description: 'People administration',
    permissions: any(
      'user.read',
      'user.create',
      'user.update',
      'user.deactivate',
      'position.read',
      'position.create',
      'position.update',
      'audit.read',
    ),
  },
  {
    key: 'bde',
    name: 'BDE',
    description: 'Business development',
    permissions: any('worksheet.create'),
  },
  {
    key: 'customer_care',
    name: 'Customer Care',
    description: 'Client intake and delivery',
    permissions: any('worksheet.create', 'worksheet.deliver'),
  },
  {
    key: 'finance_accounting',
    name: 'Finance / Accounting',
    description: 'Intake and delivery stages',
    permissions: any('worksheet.create', 'worksheet.deliver', 'company.read'),
  },
];

/** Parents first. */
export const DEPARTMENTS: { code: string; name: string; parent?: string }[] = [
  { code: 'MGMT', name: 'Management' },
  { code: 'OPS', name: 'Operations', parent: 'MGMT' },
  { code: 'HR', name: 'Human Resources', parent: 'MGMT' },
  { code: 'BD', name: 'Business Development', parent: 'MGMT' },
  { code: 'CC', name: 'Customer Care', parent: 'MGMT' },
  { code: 'FIN', name: 'Finance & Accounts', parent: 'MGMT' },
];

/** Parents first. One demo user is created per position. */
export const POSITIONS: {
  code: string;
  name: string;
  department: string;
  role: string;
  parent?: string;
  seesAll?: boolean;
  allBranches?: boolean;
}[] = [
  {
    code: 'BOARD',
    name: 'Board',
    department: 'MGMT',
    role: 'board',
    seesAll: true,
    allBranches: true,
  },
  {
    code: 'GM',
    name: 'General Manager',
    department: 'MGMT',
    role: 'general_manager',
    parent: 'BOARD',
    allBranches: true,
  },
  {
    code: 'OPS_MGR',
    name: 'Operations Manager',
    department: 'OPS',
    role: 'operations_manager',
    parent: 'GM',
  },
  {
    code: 'FIN_OFFICER',
    name: 'Finance Officer',
    department: 'OPS',
    role: 'finance_officer',
    parent: 'OPS_MGR',
  },
  {
    code: 'FIN_EXEC',
    name: 'Finance Executive',
    department: 'OPS',
    role: 'finance_executive',
    parent: 'FIN_OFFICER',
  },
  { code: 'HR', name: 'HR', department: 'HR', role: 'hr', parent: 'GM' },
  { code: 'BDE', name: 'BDE', department: 'BD', role: 'bde', parent: 'GM' },
  {
    code: 'CUSTOMER_CARE',
    name: 'Customer Care',
    department: 'CC',
    role: 'customer_care',
    parent: 'GM',
  },
  {
    code: 'FIN_ACCOUNTS',
    name: 'Finance / Accounting',
    department: 'FIN',
    role: 'finance_accounting',
    parent: 'GM',
  },
];
