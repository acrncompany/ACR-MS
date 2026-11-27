import {
  PERMISSIONS,
  STANDARD_ACTIONS,
} from '../../src/modules/access/domain/permission-catalogue.js';

/**
 * Default ACR roles and org chart (dev seed). The permission catalogue lives in the backend
 * access module.
 * Hierarchy: Board > General Manager > { Operations Manager > Finance Officer (Team Lead) >
 * Finance Executive (Team Member); HR; BDE; Customer Care; Finance / Accounting }.
 */

export { PERMISSIONS };

type Grants = Record<string, readonly string[]>;

const ALL_STANDARD = STANDARD_ACTIONS;
const keysOf = (grants: Grants): Set<string> =>
  new Set(
    Object.entries(grants).flatMap(([module, actions]) =>
      actions.map((action) => `${module}.${action}`),
    ),
  );

const BOARD = new Set(PERMISSIONS.map((p) => p.key));

/** Mirrors the frontend's default role matrix; the backend catalogue stays the source of truth. */
export const ROLES: {
  key: string;
  name: string;
  description: string;
  permissions: ReadonlySet<string>;
}[] = [
  { key: 'board', name: 'Board', description: 'Full access', permissions: BOARD },
  {
    key: 'general_manager',
    name: 'General Manager',
    description: 'Everything except moving people between positions',
    permissions: keysOf({
      dashboard: ['view'],
      clients: ['view', 'create', 'edit', 'deactivate'],
      hr: ['view'],
      users: ['view', 'create', 'edit', 'deactivate'],
      worksheet: ['view', 'assign', 'approve', 'reassign', 'retarget'],
      audit: ['view'],
    }),
  },
  {
    key: 'operations_manager',
    name: 'Operations Manager',
    description: 'All operations work sheets',
    permissions: keysOf({
      dashboard: ['view'],
      clients: ['view', 'create', 'edit', 'deactivate', 'reveal_credentials'],
      users: ['view', 'create', 'edit', 'deactivate'],
      worksheet: ['view', 'plan', 'approve', 'reassign', 'retarget'],
    }),
  },
  {
    key: 'finance_officer',
    name: 'Finance Officer (Team Lead)',
    description: 'Own and team work sheets',
    permissions: keysOf({
      dashboard: ['view'],
      clients: ['view', 'reveal_credentials'],
      users: ['view', 'create', 'edit', 'deactivate'],
      worksheet: ['view', 'allocate', 'finalize', 'document', 'reassign'],
    }),
  },
  {
    key: 'finance_executive',
    name: 'Finance Executive (Team Member)',
    description: 'Executes assigned work sheets',
    permissions: keysOf({
      dashboard: ['view'],
      clients: ['view', 'reveal_credentials'],
      worksheet: ['view', 'execute'],
    }),
  },
  {
    key: 'hr',
    name: 'HR',
    description: 'People administration',
    permissions: keysOf({ dashboard: ['view'], hr: ALL_STANDARD }),
  },
  {
    key: 'bde',
    name: 'BDE',
    description: 'Business development',
    permissions: keysOf({ dashboard: ['view'], clients: ['view'] }),
  },
  {
    key: 'customer_care',
    name: 'Customer Care',
    description: 'Client intake and delivery',
    permissions: keysOf({ dashboard: ['view'], clients: ['view'] }),
  },
  {
    key: 'finance_accounting',
    name: 'Finance / Accounting',
    description: 'Intake and delivery stages',
    permissions: keysOf({
      dashboard: ['view'],
      clients: ['view', 'edit'],
      worksheet: ['view', 'create', 'deliver'],
    }),
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
  /** The CEO's short display label. Only the ones he confirmed are set; the rest stay null. */
  designationCode?: string;
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
    designationCode: 'GM',
    // Board and GM see every record (the reporting line limits everyone else).
    seesAll: true,
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
    designationCode: 'TL',
  },
  {
    code: 'FIN_EXEC',
    name: 'Finance Executive',
    department: 'OPS',
    role: 'finance_executive',
    parent: 'FIN_OFFICER',
    designationCode: 'TM',
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

/** Data-driven lookups for client masters (per tenant). The CEO's short forms stay AS-IS. */
export const ORGANISATION_TYPES: { key: string; label: string }[] = [
  { key: 'individual', label: 'Individual' },
  { key: 'proprietorship', label: 'Proprietorship' },
  { key: 'partnership', label: 'Partnership' },
  { key: 'llp', label: 'LLP' },
  { key: 'pvt-co', label: 'Pvt Co' },
  { key: 'pub-co', label: 'Pub Co' },
  { key: 'listed-co', label: 'Listed Co' },
  { key: 'trust', label: 'Trust' },
  { key: 'society', label: 'Society' },
  { key: 'others', label: 'Others' },
];

export const COMPLIANCE_LAWS: { key: string; label: string }[] = [
  'MCA',
  'TDS',
  'GST',
  'PF',
  'ESI',
  'LLP',
  'FORM-11',
  'FORM-8',
  'MGT',
  'KYC',
  'GSTR-1',
  'GSTR-3B',
].map((key) => ({ key, label: key }));
