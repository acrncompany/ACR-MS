export interface NavItem {
  label: string;
  /** Material Symbols (Rounded) ligature name. */
  icon: string;
  route: string;
  /** Permission needed to see the item ("module.action"). */
  permission: string;
  /** Sidebar group heading; groups appear in order of first use. */
  section: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    icon: 'dashboard',
    route: '/dashboard',
    permission: 'dashboard.view',
    section: 'Overview',
  },
  {
    label: 'Work Sheets',
    icon: 'assignment',
    route: '/worksheets/list',
    permission: 'worksheet.view',
    section: 'Work Sheets',
  },
  {
    label: 'Employees',
    icon: 'groups',
    route: '/hr/employees',
    permission: 'hr.view',
    section: 'People',
  },
  {
    label: 'Attendance',
    icon: 'how_to_reg',
    route: '/hr/attendance',
    permission: 'hr.view',
    section: 'People',
  },
  {
    label: 'Leave requests',
    icon: 'beach_access',
    route: '/hr/leave',
    permission: 'hr.view',
    section: 'People',
  },
  {
    label: 'Masters',
    icon: 'database',
    route: '/masters',
    permission: 'clients.view',
    section: 'Masters',
  },
  {
    label: 'Organization',
    icon: 'account_tree',
    route: '/admin/organization',
    permission: 'organization.view',
    section: 'Administration',
  },
  {
    label: 'Users',
    icon: 'manage_accounts',
    route: '/admin/users',
    permission: 'users.view',
    section: 'Administration',
  },
  {
    label: 'Roles & permissions',
    icon: 'admin_panel_settings',
    route: '/admin/roles',
    permission: 'roles.view',
    section: 'Administration',
  },
];
