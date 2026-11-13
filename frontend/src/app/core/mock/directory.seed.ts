import { Action, DirectorySnapshot, ModuleDef, Role, WORKSHEET_ACTIONS } from './directory.models';

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

const V: Action = 'view';
const C: Action = 'create';
const E: Action = 'edit';
const A: Action = 'approve';
const ALL: Action[] = [V, C, E, A];

function role(
  id: string,
  name: string,
  permissions: Record<string, Action[]>,
  flags: { seesAll?: boolean; locked?: boolean } = {},
): Role {
  return {
    id,
    name,
    seesAll: flags.seesAll ?? false,
    locked: flags.locked ?? false,
    permissions,
  };
}

export function seedDirectory(): DirectorySnapshot {
  return {
    departments: [
      { id: 'd-board', name: 'Board' },
      { id: 'd-mgmt', name: 'Management' },
      { id: 'd-ops', name: 'Operations' },
      { id: 'd-tax', name: 'Tax & Audit' },
      { id: 'd-hr', name: 'Human Resources' },
      { id: 'd-bd', name: 'Business Development' },
      { id: 'd-care', name: 'Customer Care' },
      { id: 'd-fin', name: 'Finance & Accounts' },
    ],
    roles: [
      role(
        'r-board',
        'Board (Admin)',
        Object.fromEntries(
          MODULES.map((m) => [
            m.key,
            m.key === 'worksheet' ? WORKSHEET_ACTIONS.map((a) => a.action) : [...ALL],
          ]),
        ),
        {
          seesAll: true,
          locked: true,
        },
      ),
      role('r-gm', 'General Manager', {
        dashboard: [V],
        clients: [V, C, E],
        hr: [V],
        users: [V, C, E],
        worksheet: ['view', 'assign', 'approve', 'reassign', 'retarget'],
      }),
      role('r-ops', 'Operations Manager', {
        dashboard: [V],
        clients: [V, C, E],
        users: [V, C, E],
        worksheet: ['view', 'plan', 'approve', 'reassign', 'retarget', 'reveal'],
      }),
      role('r-fo', 'Finance Officer / Team Lead', {
        dashboard: [V],
        clients: [V],
        users: [V, C, E],
        worksheet: ['view', 'allocate', 'finalize', 'document', 'reassign', 'reveal'],
      }),
      role('r-fe', 'Finance Executive / Team Member', {
        dashboard: [V],
        clients: [V],
        worksheet: ['view', 'execute', 'reveal'],
      }),
      role('r-hr', 'HR', { dashboard: [V], hr: [V, C, E, A] }),
      role('r-bde', 'Business Development Executive', { dashboard: [V], clients: [V] }),
      role('r-care', 'Customer Care', { dashboard: [V], clients: [V] }),
      role('r-acc', 'Finance / Accounting', {
        dashboard: [V],
        clients: [V, E],
        worksheet: ['view', 'create', 'deliver'],
      }),
    ],
    positions: [
      { id: 'p-board', title: 'Board', departmentId: 'd-board', parentId: null, roleId: 'r-board' },
      {
        id: 'p-gm',
        title: 'General Manager',
        departmentId: 'd-mgmt',
        parentId: 'p-board',
        roleId: 'r-gm',
      },
      {
        id: 'p-ops',
        title: 'Operations Manager',
        departmentId: 'd-ops',
        parentId: 'p-gm',
        roleId: 'r-ops',
      },
      {
        id: 'p-fo',
        title: 'Finance Officer / Team Lead',
        departmentId: 'd-tax',
        parentId: 'p-ops',
        roleId: 'r-fo',
      },
      {
        id: 'p-fe',
        title: 'Finance Executive / Team Member',
        departmentId: 'd-tax',
        parentId: 'p-fo',
        roleId: 'r-fe',
      },
      { id: 'p-hr', title: 'HR', departmentId: 'd-hr', parentId: 'p-gm', roleId: 'r-hr' },
      {
        id: 'p-bde',
        title: 'Business Development Executive',
        departmentId: 'd-bd',
        parentId: 'p-gm',
        roleId: 'r-bde',
      },
      {
        id: 'p-care',
        title: 'Customer Care',
        departmentId: 'd-care',
        parentId: 'p-gm',
        roleId: 'r-care',
      },
      {
        id: 'p-acc',
        title: 'Finance / Accounting',
        departmentId: 'd-fin',
        parentId: 'p-gm',
        roleId: 'r-acc',
      },
    ],
    users: [
      user('u-board', 'Rajesh Menon', 'board@acr.demo', 'p-board', null),
      user('u-gm', 'Anita Krishnan', 'gm@acr.demo', 'p-gm', 'u-board'),
      user('u-ops', 'Suresh Iyer', 'ops@acr.demo', 'p-ops', 'u-gm'),
      user('u-fo', 'Priya Nair', 'fo@acr.demo', 'p-fo', 'u-ops'),
      user('u-fe', 'Arjun Das', 'fe@acr.demo', 'p-fe', 'u-fo'),
      user('u-fe2', 'Meera Pillai', 'meera@acr.demo', 'p-fe', 'u-fo'),
      user('u-fo2', 'Rohit Bhat', 'rohit@acr.demo', 'p-fo', 'u-ops'),
      user('u-fe3', 'Sneha Kapoor', 'sneha@acr.demo', 'p-fe', 'u-fo2'),
      user('u-hr', 'Divya Sharma', 'hr@acr.demo', 'p-hr', 'u-gm'),
      user('u-bde', 'Karthik Rao', 'bde@acr.demo', 'p-bde', 'u-gm'),
      user('u-care', 'Fatima Khan', 'care@acr.demo', 'p-care', 'u-gm'),
      user('u-acc', 'Vivek Joshi', 'accounts@acr.demo', 'p-acc', 'u-gm'),
    ],
  };
}

function user(
  id: string,
  name: string,
  email: string,
  positionId: string,
  managerId: string | null,
) {
  return { id, name, email, positionId, managerId, active: true };
}
