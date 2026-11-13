import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, defer, of, throwError } from 'rxjs';
import { SessionService } from '../../../core/auth/session.service';
import { DirectoryStore } from '../../../core/mock/directory.store';
import { MODULES } from '../../../core/mock/directory.seed';
import { Action, DirectoryUser, ModuleDef, Position } from '../domain/admin.models';
import { DirectoryRepository } from '../domain/directory.repository';
import { WorksheetStore } from '../../worksheets/data/worksheet.store';

/** Edits go to the in-memory DirectoryStore, which persists them to localStorage. */
@Injectable()
export class MockDirectoryRepository extends DirectoryRepository {
  private readonly store = inject(DirectoryStore);
  private readonly session = inject(SessionService);
  private readonly worksheets = inject(WorksheetStore);

  override readonly modules = signal<ModuleDef[]>(MODULES).asReadonly();
  override readonly departments = this.store.departments.asReadonly();
  override readonly positions = this.store.positions.asReadonly();
  override readonly roles = this.store.roles.asReadonly();
  override readonly users = this.store.users.asReadonly();

  override readonly visibleUsers = computed(() => {
    const me = this.session.user();
    if (!me) return [];
    if (me.seesAll) return this.store.users();
    const ids = this.store.subtreeUserIds(me.id);
    return this.store.users().filter((u) => ids.has(u.id));
  });
  override readonly creatablePositions = computed(() => {
    // Read the signals so the list follows edits to positions and users.
    this.store.positions();
    this.store.users();
    const me = this.session.user();
    return me ? this.store.creatablePositions(me.id) : [];
  });

  override canManageUser(userId: string): boolean {
    const me = this.session.user();
    return !!me && this.store.canManageUser(me.id, userId);
  }

  private actorId(): string {
    return this.session.user()?.id ?? '';
  }

  /** Runs a store mutation; a returned string is a rule violation and becomes an error. */
  private run(change: () => string | null | void): Observable<void> {
    return defer(() => {
      const problem = change();
      return typeof problem === 'string' ? throwError(() => new Error(problem)) : of(undefined);
    });
  }

  addDepartment(name: string): Observable<void> {
    return this.run(() => this.store.addDepartment(name));
  }
  renameDepartment(id: string, name: string): Observable<void> {
    return this.run(() => this.store.renameDepartment(id, name));
  }
  removeDepartment(id: string): Observable<void> {
    return this.run(() => this.store.removeDepartment(id));
  }

  addPosition(position: Omit<Position, 'id'>): Observable<void> {
    return this.run(() => this.store.addPosition(position));
  }
  updatePosition(id: string, changes: Partial<Omit<Position, 'id'>>): Observable<void> {
    return this.run(() => this.store.updatePosition(id, changes));
  }
  removePosition(id: string): Observable<void> {
    return this.run(() => this.store.removePosition(id));
  }

  addRole(name: string): Observable<void> {
    return this.run(() => this.store.addRole(name));
  }
  setPermission(
    roleId: string,
    module: string,
    action: Action,
    enabled: boolean,
  ): Observable<void> {
    return this.run(() => this.store.setPermission(roleId, module, action, enabled));
  }

  addUser(user: Omit<DirectoryUser, 'id'>): Observable<void> {
    return this.run(() => this.store.addUser(user, this.actorId()));
  }
  updateUser(id: string, changes: Partial<Omit<DirectoryUser, 'id'>>): Observable<void> {
    return this.run(() => this.store.updateUser(id, changes, this.actorId()));
  }

  resetDemoData(): Observable<void> {
    // Work sheets are seeded from the directory's users, so they are restored together.
    return this.run(() => {
      this.store.reset();
      this.worksheets.reset();
    });
  }
}
