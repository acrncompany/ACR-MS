import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap, throwError } from 'rxjs';
import { AppConfigService } from '../../../core/config/app-config.service';
import {
  Action,
  Department,
  DirectoryUser,
  ModuleDef,
  Position,
  Role,
} from '../domain/admin.models';
import { DirectoryRepository } from '../domain/directory.repository';

/** Real implementation. Endpoints are placeholders until the backend module exists. */
@Injectable()
export class ApiDirectoryRepository extends DirectoryRepository {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(AppConfigService).config.api.baseUrl}/admin`;

  private readonly modulesState = signal<ModuleDef[]>([]);
  private readonly departmentsState = signal<Department[]>([]);
  private readonly positionsState = signal<Position[]>([]);
  private readonly rolesState = signal<Role[]>([]);
  private readonly usersState = signal<DirectoryUser[]>([]);

  override readonly modules = this.modulesState.asReadonly();
  override readonly departments = this.departmentsState.asReadonly();
  override readonly positions = this.positionsState.asReadonly();
  override readonly roles = this.rolesState.asReadonly();
  override readonly users = this.usersState.asReadonly();
  // The backend already scopes `/users` to the caller's subtree and enforces who may create whom.
  override readonly visibleUsers = this.usersState.asReadonly();
  override readonly creatablePositions = computed(() => this.positionsState());

  override canManageUser(): boolean {
    return true;
  }

  constructor() {
    super();
    this.reload();
  }

  private reload(): void {
    this.http.get<ModuleDef[]>(`${this.base}/modules`).subscribe((v) => this.modulesState.set(v));
    this.http
      .get<Department[]>(`${this.base}/departments`)
      .subscribe((v) => this.departmentsState.set(v));
    this.http
      .get<Position[]>(`${this.base}/positions`)
      .subscribe((v) => this.positionsState.set(v));
    this.http.get<Role[]>(`${this.base}/roles`).subscribe((v) => this.rolesState.set(v));
    this.http.get<DirectoryUser[]>(`${this.base}/users`).subscribe((v) => this.usersState.set(v));
  }

  private send(
    method: 'post' | 'patch' | 'delete',
    path: string,
    body?: unknown,
  ): Observable<void> {
    const request =
      method === 'delete'
        ? this.http.delete<void>(`${this.base}${path}`)
        : this.http[method]<void>(`${this.base}${path}`, body);
    return request.pipe(tap(() => this.reload()));
  }

  addDepartment(name: string): Observable<void> {
    return this.send('post', '/departments', { name });
  }
  renameDepartment(id: string, name: string): Observable<void> {
    return this.send('patch', `/departments/${id}`, { name });
  }
  removeDepartment(id: string): Observable<void> {
    return this.send('delete', `/departments/${id}`);
  }

  addPosition(position: Omit<Position, 'id'>): Observable<void> {
    return this.send('post', '/positions', position);
  }
  updatePosition(id: string, changes: Partial<Omit<Position, 'id'>>): Observable<void> {
    return this.send('patch', `/positions/${id}`, changes);
  }
  removePosition(id: string): Observable<void> {
    return this.send('delete', `/positions/${id}`);
  }

  addRole(name: string): Observable<void> {
    return this.send('post', '/roles', { name });
  }
  setPermission(
    roleId: string,
    module: string,
    action: Action,
    enabled: boolean,
  ): Observable<void> {
    return this.send('patch', `/roles/${roleId}/permissions`, { module, action, enabled });
  }

  addUser(user: Omit<DirectoryUser, 'id'>): Observable<void> {
    return this.send('post', '/users', user);
  }
  updateUser(id: string, changes: Partial<Omit<DirectoryUser, 'id'>>): Observable<void> {
    return this.send('patch', `/users/${id}`, changes);
  }

  resetDemoData(): Observable<void> {
    return throwError(() => new Error('Demo data can only be reset in mock mode.'));
  }
}
