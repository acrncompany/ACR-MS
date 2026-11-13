import { Injectable, computed, signal } from '@angular/core';
import {
  Action,
  Department,
  DirectorySnapshot,
  DirectoryUser,
  Position,
  Role,
} from './directory.models';
import { seedDirectory } from './directory.seed';

const STORAGE_KEY = 'acr-demo-directory-v4';

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * In-memory org/roles/users used only by mock repositories. Edits are written to localStorage so
 * they survive a refresh during demos; `reset()` restores the seed data.
 */
@Injectable({ providedIn: 'root' })
export class DirectoryStore {
  readonly departments = signal<Department[]>([]);
  readonly positions = signal<Position[]>([]);
  readonly roles = signal<Role[]>([]);
  readonly users = signal<DirectoryUser[]>([]);

  private readonly positionById = computed(() => new Map(this.positions().map((p) => [p.id, p])));
  private readonly roleById = computed(() => new Map(this.roles().map((r) => [r.id, r])));
  private readonly deptById = computed(() => new Map(this.departments().map((d) => [d.id, d])));
  private readonly userById = computed(() => new Map(this.users().map((u) => [u.id, u])));

  constructor() {
    this.apply(this.load() ?? seedDirectory());
  }

  // ---- lookups ----
  position(id: string): Position | undefined {
    return this.positionById().get(id);
  }
  role(id: string): Role | undefined {
    return this.roleById().get(id);
  }
  department(id: string): Department | undefined {
    return this.deptById().get(id);
  }
  user(id: string): DirectoryUser | undefined {
    return this.userById().get(id);
  }
  userName(id: string): string {
    return this.user(id)?.name ?? '—';
  }
  roleOfUser(user: DirectoryUser): Role | undefined {
    const position = this.position(user.positionId);
    return position ? this.role(position.roleId) : undefined;
  }
  /** Permission keys such as `clients.view`. */
  permissionsOf(roleId: string): string[] {
    const role = this.role(roleId);
    if (!role) return [];
    return Object.entries(role.permissions).flatMap(([module, actions]) =>
      actions.map((action) => `${module}.${action}`),
    );
  }

  /** The user plus everyone who reports to them, directly or indirectly. */
  subtreeUserIds(userId: string): Set<string> {
    const ids = new Set([userId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const user of this.users()) {
        if (user.managerId && ids.has(user.managerId) && !ids.has(user.id)) {
          ids.add(user.id);
          grew = true;
        }
      }
    }
    return ids;
  }

  // ---- hierarchy rules (UX only; the backend must enforce the same rules) ----
  /** Board-style roles (`seesAll`) are not limited by the reporting line. */
  private isUnrestricted(actorId: string): boolean {
    const actor = this.user(actorId);
    return !!actor && !!this.roleOfUser(actor)?.seesAll;
  }

  /** Positions the user may create people in: only those directly below their own position. */
  creatablePositions(actorId: string): Position[] {
    const actor = this.user(actorId);
    if (!actor) return [];
    if (this.isUnrestricted(actorId)) return this.positions();
    return this.positions().filter((p) => p.parentId === actor.positionId);
  }

  /** Users the actor may edit or deactivate: everyone below them, never themselves. */
  canManageUser(actorId: string, targetId: string): boolean {
    if (this.isUnrestricted(actorId)) return true;
    return targetId !== actorId && this.subtreeUserIds(actorId).has(targetId);
  }

  // ---- departments ----
  addDepartment(name: string): void {
    this.departments.update((list) => [...list, { id: newId('d'), name }]);
    this.save();
  }
  renameDepartment(id: string, name: string): void {
    this.departments.update((list) => list.map((d) => (d.id === id ? { ...d, name } : d)));
    this.save();
  }
  /** Returns an error message when the department is still in use. */
  removeDepartment(id: string): string | null {
    if (this.positions().some((p) => p.departmentId === id)) {
      return 'Move or remove the positions in this department first.';
    }
    this.departments.update((list) => list.filter((d) => d.id !== id));
    this.save();
    return null;
  }

  // ---- positions ----
  addPosition(position: Omit<Position, 'id'>): void {
    this.positions.update((list) => [...list, { ...position, id: newId('p') }]);
    this.save();
  }
  updatePosition(id: string, changes: Partial<Omit<Position, 'id'>>): string | null {
    const current = this.position(id);
    if (!current) return 'Position not found.';
    const moved = changes.parentId !== undefined && changes.parentId !== current.parentId;
    if (
      moved &&
      (changes.parentId === id || this.positionSubtree(id).has(changes.parentId ?? ''))
    ) {
      return 'A position cannot report to itself or to one of its own reports.';
    }
    this.positions.update((list) => list.map((p) => (p.id === id ? { ...p, ...changes } : p)));
    // Moving a position re-points its holders to a manager in the new parent position.
    if (moved) {
      const manager = changes.parentId
        ? this.users().find((u) => u.positionId === changes.parentId && u.active)
        : undefined;
      this.users.update((list) =>
        list.map((u) => (u.positionId === id ? { ...u, managerId: manager?.id ?? null } : u)),
      );
    }
    this.save();
    return null;
  }
  removePosition(id: string): string | null {
    if (this.positions().some((p) => p.parentId === id)) {
      return 'Move or remove the positions reporting to this one first.';
    }
    if (this.users().some((u) => u.positionId === id)) {
      return 'Reassign the users holding this position first.';
    }
    this.positions.update((list) => list.filter((p) => p.id !== id));
    this.save();
    return null;
  }
  positionSubtree(id: string): Set<string> {
    const ids = new Set<string>();
    const walk = (parent: string): void => {
      for (const p of this.positions()) {
        if (p.parentId === parent && !ids.has(p.id)) {
          ids.add(p.id);
          walk(p.id);
        }
      }
    };
    walk(id);
    return ids;
  }

  // ---- roles ----
  addRole(name: string): void {
    this.roles.update((list) => [
      ...list,
      { id: newId('r'), name, seesAll: false, locked: false, permissions: {} },
    ]);
    this.save();
  }
  setPermission(roleId: string, module: string, action: Action, enabled: boolean): void {
    this.roles.update((list) =>
      list.map((role) => {
        if (role.id !== roleId || role.locked) return role;
        const current = role.permissions[module] ?? [];
        let next: Action[];
        if (enabled) {
          // Any permission implies view.
          next = [...new Set<Action>([...current, action, 'view'])];
        } else if (action === 'view') {
          next = []; // removing view removes everything for that module
        } else {
          next = current.filter((a) => a !== action);
        }
        return { ...role, permissions: { ...role.permissions, [module]: next } };
      }),
    );
    this.save();
  }

  // ---- users ----
  /** `actorId` is the signed-in user; they can only create people one level below themselves. */
  addUser(user: Omit<DirectoryUser, 'id'>, actorId: string): string | null {
    if (!this.creatablePositions(actorId).some((p) => p.id === user.positionId)) {
      return 'You can only create users in the position directly below yours.';
    }
    const manager = this.isUnrestricted(actorId) ? user.managerId : actorId;
    this.users.update((list) => [...list, { ...user, managerId: manager, id: newId('u') }]);
    this.save();
    return null;
  }
  updateUser(
    id: string,
    changes: Partial<Omit<DirectoryUser, 'id'>>,
    actorId: string,
  ): string | null {
    if (!this.canManageUser(actorId, id)) return 'You can only manage people who report to you.';
    const current = this.user(id);
    const restricted = !this.isUnrestricted(actorId);
    if (
      restricted &&
      current &&
      ((changes.positionId && changes.positionId !== current.positionId) ||
        (changes.managerId !== undefined && changes.managerId !== current.managerId))
    ) {
      return 'Only the Board can change a person’s position or manager.';
    }
    if (changes.managerId && this.subtreeUserIds(id).has(changes.managerId)) {
      return 'A user cannot report to themselves or to one of their own reports.';
    }
    this.users.update((list) => list.map((u) => (u.id === id ? { ...u, ...changes } : u)));
    this.save();
    return null;
  }

  reset(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable
    }
    this.apply(seedDirectory());
  }

  private apply(snapshot: DirectorySnapshot): void {
    this.departments.set(snapshot.departments);
    this.positions.set(snapshot.positions);
    this.roles.set(snapshot.roles);
    this.users.set(snapshot.users);
  }

  private save(): void {
    const snapshot: DirectorySnapshot = {
      departments: this.departments(),
      positions: this.positions(),
      roles: this.roles(),
      users: this.users(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // storage unavailable; edits just won't persist
    }
  }

  private load(): DirectorySnapshot | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as DirectorySnapshot;
      return data.users?.length && data.positions?.length && data.roles?.length ? data : null;
    } catch {
      return null;
    }
  }
}
