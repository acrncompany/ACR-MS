/** A node of a parent/child tree (departments, positions). */
export interface TreeNode {
  id: string;
  parentId: string | null;
}

/**
 * True when making `newParentId` the parent of `id` would create a cycle: the node would become
 * its own ancestor (itself, or one of its own descendants as parent). Pure, so it is unit tested;
 * a database trigger repeats the check under a lock for concurrent edits.
 */
export function wouldCreateCycle(
  nodes: readonly TreeNode[],
  id: string,
  newParentId: string | null,
): boolean {
  if (!newParentId) return false;
  const parentOf = new Map(nodes.map((n) => [n.id, n.parentId]));
  let current: string | null | undefined = newParentId;
  const seen = new Set<string>();
  while (current) {
    if (current === id) return true;
    if (seen.has(current)) return true; // existing corruption: refuse to make it worse
    seen.add(current);
    current = parentOf.get(current);
  }
  return false;
}
