import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, from, map, of, switchMap } from 'rxjs';
import { AppConfigService } from '../../../core/config/app-config.service';
import { Session, SessionUser } from '../../../core/auth/session.service';
import { LoginCredentials } from '../domain/auth.models';
import { AuthRepository } from '../domain/auth.repository';

/** Custom header the backend requires on cookie-authenticated endpoints (CSRF defence). */
export const CSRF_HEADER = 'X-Requested-With';
export const CSRF_HEADER_VALUE = 'acr-ms';

interface TokenResponse {
  accessToken: string;
  expiresIn: number;
}

interface MeResponse {
  user: {
    id: string;
    name: string;
    email: string;
    employeeCode: string;
    mustChangePassword: boolean;
  };
  position: { id: string; code: string; name: string } | null;
  department: { id: string; code: string; name: string } | null;
  roles: { id: string; key: string; name: string }[];
  permissions: string[];
  seesAll: boolean;
  branches: { id: string; code: string; name: string }[];
  tenant: { name: string };
}

const REFRESH_LOCK = 'acr-ms-refresh';

/**
 * Real implementation. The access token lives only in memory (SessionService); the refresh
 * token is an httpOnly cookie that JavaScript cannot read, so it is never handled here.
 */
@Injectable()
export class ApiAuthRepository extends AuthRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private url(path: string): string {
    return `${this.config.config.api.baseUrl}/auth/${path}`;
  }

  private readonly csrf = new HttpHeaders({ [CSRF_HEADER]: CSRF_HEADER_VALUE });

  login(credentials: LoginCredentials): Observable<Session> {
    return this.http
      .post<TokenResponse>(this.url('login'), credentials, { withCredentials: true })
      .pipe(switchMap((tokens) => this.loadSession(tokens.accessToken)));
  }

  refresh(): Observable<string> {
    const call = () =>
      this.http.post<TokenResponse>(this.url('refresh'), null, {
        headers: this.csrf,
        withCredentials: true,
      });
    // Tabs share one cookie and every refresh rotates it. Taking turns across tabs makes the
    // second tab send the cookie the first tab just received, instead of a stale one.
    const run = (): Promise<string> =>
      new Promise((resolve, reject) =>
        call().subscribe({ next: (r) => resolve(r.accessToken), error: reject }),
      );
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    const promise = locks ? locks.request(REFRESH_LOCK, run) : run();
    return from(promise);
  }

  restore(): Observable<Session | null> {
    return this.refresh().pipe(
      switchMap((token) => this.loadSession(token)),
      // No cookie, expired or revoked: simply not signed in.
      catchError(() => of(null)),
    );
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(this.url('logout'), null, { headers: this.csrf, withCredentials: true })
      .pipe(map(() => undefined));
  }

  logoutAll(): Observable<void> {
    return this.http
      .post<void>(this.url('logout-all'), null, { headers: this.csrf, withCredentials: true })
      .pipe(map(() => undefined));
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http
      .post<void>(this.url('change-password'), { currentPassword, newPassword })
      .pipe(map(() => undefined));
  }

  /** Loads the profile with an explicit token (the session does not hold it yet). */
  private loadSession(accessToken: string): Observable<Session> {
    return this.http
      .get<MeResponse>(this.url('me'), {
        headers: new HttpHeaders({ Authorization: `Bearer ${accessToken}` }),
      })
      .pipe(map((me) => ({ accessToken, user: toSessionUser(me) })));
  }
}

function toSessionUser(me: MeResponse): SessionUser {
  return {
    id: me.user.id,
    name: me.user.name,
    email: me.user.email,
    employeeCode: me.user.employeeCode,
    mustChangePassword: me.user.mustChangePassword,
    roleId: me.roles[0]?.id ?? '',
    role: me.roles.map((r) => r.name).join(', '),
    department: me.department?.name ?? '',
    position: me.position?.name ?? '',
    seesAll: me.seesAll,
    permissions: me.permissions,
    branches: me.branches,
    tenantName: me.tenant.name,
  };
}
