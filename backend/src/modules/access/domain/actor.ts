/**
 * Who is making a request, as the SERVER resolved it (never read from a request body): the
 * permissions their roles grant, whether they see every record, and the branches they may use.
 */
export interface Actor {
  userId: string;
  tenantId: string;
  positionId: string | null;
  /** Board and GM: sees every record regardless of the reporting line. */
  seesAll: boolean;
  /** May use every branch without user_branch_access rows. */
  allBranches: boolean;
  /** Branches the actor may work in (all branches when `allBranches`). */
  branchIds: string[];
  homeBranchId: string | null;
  permissions: ReadonlySet<string>;
}

export function hasPermission(actor: Actor, key: string): boolean {
  return actor.permissions.has(key);
}
