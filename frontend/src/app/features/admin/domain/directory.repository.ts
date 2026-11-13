import { Signal } from '@angular/core';
import { Observable } from 'rxjs';
import { Action, Department, DirectoryUser, ModuleDef, Position, Role } from './admin.models';

/**
 * Organization, roles and users. Positions carry a role (many positions may share one role), so
 * permissions can change without touching the hierarchy. Mutations error with a readable message
 * when a rule is broken (cycles, positions still in use, ...).
 */
export abstract class DirectoryRepository {
  abstract readonly modules: Signal<ModuleDef[]>;
  abstract readonly departments: Signal<Department[]>;
  abstract readonly positions: Signal<Position[]>;
  abstract readonly roles: Signal<Role[]>;
  abstract readonly users: Signal<DirectoryUser[]>;
  /** Users the signed-in person may see: themselves and everyone below them (all for Board). */
  abstract readonly visibleUsers: Signal<DirectoryUser[]>;
  /** Positions the signed-in person may create users in: only those directly below theirs. */
  abstract readonly creatablePositions: Signal<Position[]>;
  /** Whether the signed-in person may edit or deactivate this user. */
  abstract canManageUser(userId: string): boolean;

  abstract addDepartment(name: string): Observable<void>;
  abstract renameDepartment(id: string, name: string): Observable<void>;
  abstract removeDepartment(id: string): Observable<void>;

  abstract addPosition(position: Omit<Position, 'id'>): Observable<void>;
  abstract updatePosition(id: string, changes: Partial<Omit<Position, 'id'>>): Observable<void>;
  abstract removePosition(id: string): Observable<void>;

  abstract addRole(name: string): Observable<void>;
  abstract setPermission(
    roleId: string,
    module: string,
    action: Action,
    enabled: boolean,
  ): Observable<void>;

  abstract addUser(user: Omit<DirectoryUser, 'id'>): Observable<void>;
  abstract updateUser(id: string, changes: Partial<Omit<DirectoryUser, 'id'>>): Observable<void>;

  /** Restores the sample organization, roles and users (mock mode only). */
  abstract resetDemoData(): Observable<void>;
}
