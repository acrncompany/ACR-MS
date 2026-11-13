import { Injectable, inject } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { Session, SessionUser } from '../../../core/auth/session.service';
import { DirectoryStore } from '../../../core/mock/directory.store';
import { DemoAccount, LoginCredentials } from '../domain/auth.models';
import { AuthRepository } from '../domain/auth.repository';

// TODO: DEVELOPMENT ONLY. These demo credentials exist so every role can be tried without a
// backend. They must NEVER be used or shipped in production: set `mockMode` to false in
// config.json so ApiAuthRepository is used. They live here and nowhere else.
const DEMO_PASSWORD = 'Demo@123';

const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { label: 'Board', icon: 'shield_person', email: 'board@acr.demo', password: DEMO_PASSWORD },
  { label: 'General Manager', icon: 'badge', email: 'gm@acr.demo', password: DEMO_PASSWORD },
  {
    label: 'Operations Manager',
    icon: 'engineering',
    email: 'ops@acr.demo',
    password: DEMO_PASSWORD,
  },
  {
    label: 'Finance Officer',
    icon: 'supervisor_account',
    email: 'fo@acr.demo',
    password: DEMO_PASSWORD,
  },
  { label: 'Finance Executive', icon: 'person', email: 'fe@acr.demo', password: DEMO_PASSWORD },
  { label: 'HR', icon: 'diversity_3', email: 'hr@acr.demo', password: DEMO_PASSWORD },
  { label: 'BDE', icon: 'trending_up', email: 'bde@acr.demo', password: DEMO_PASSWORD },
  {
    label: 'Customer Care',
    icon: 'support_agent',
    email: 'care@acr.demo',
    password: DEMO_PASSWORD,
  },
  {
    label: 'Finance / Accounting',
    icon: 'calculate',
    email: 'accounts@acr.demo',
    password: DEMO_PASSWORD,
  },
];

/**
 * TODO: DEVELOPMENT ONLY. Signs in any active directory user whose password is the shared demo
 * password and issues a fake token. Never use or enable this in production.
 */
@Injectable()
export class MockAuthRepository extends AuthRepository {
  private readonly directory = inject(DirectoryStore);

  override readonly demoAccounts = DEMO_ACCOUNTS;

  login(credentials: LoginCredentials): Observable<Session> {
    const email = credentials.email.trim().toLowerCase();
    const user = this.directory.users().find((u) => u.email.toLowerCase() === email);
    if (!user || credentials.password !== DEMO_PASSWORD) {
      return throwError(() => new Error('Invalid email or password'));
    }
    if (!user.active) {
      return throwError(() => new Error('This account has been deactivated'));
    }
    const position = this.directory.position(user.positionId);
    const role = this.directory.role(position?.roleId ?? '');
    if (!position || !role) {
      return throwError(() => new Error('This account has no role assigned'));
    }
    const sessionUser: SessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: role.id,
      role: role.name,
      position: position.title,
      department: this.directory.department(position.departmentId)?.name ?? '',
      seesAll: role.seesAll,
      permissions: this.directory.permissionsOf(role.id),
    };
    return of<Session>({ accessToken: 'mock-token', user: sessionUser }).pipe(delay(300));
  }

  logout(): Observable<void> {
    return of(undefined);
  }
}
