export interface UserAccess {
  roles: { id: string; key: string; name: string }[];
  /** Permission keys such as "worksheet.assign", sorted, without duplicates. */
  permissions: string[];
}

export interface RoleWithPermissions {
  id: string;
  key: string;
  name: string;
  description: string | null;
  /** Permission keys such as "clients.view", sorted. */
  permissions: string[];
}

export abstract class AccessRepository {
  abstract findUserAccess(userId: string): Promise<UserAccess>;
  abstract listRoles(): Promise<RoleWithPermissions[]>;
}
