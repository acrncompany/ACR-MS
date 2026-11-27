import { Injectable, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  Observable,
  catchError,
  finalize,
  firstValueFrom,
  map,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { AuthRepository } from '../../features/auth/domain/auth.repository';
import { LoginCredentials } from '../../features/auth/domain/auth.models';
import { SessionService } from './session.service';

type TabMessage = { type: 'token'; token: string } | { type: 'signed-out' };

/**
 * Orchestrates authentication for the whole app: sign in/out, silent restore on page load,
 * and the single shared token refresh used by the HTTP interceptor. The session state itself
 * lives in SessionService (in memory only).
 */
@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly repo = inject(AuthRepository);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  /** The one refresh in flight; parallel 401s all wait for it instead of starting their own. */
  private inflight: Observable<string> | null = null;
  private readonly channel =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('acr-ms-auth');

  constructor() {
    // Other tabs share the refresh cookie, so a refresh or sign-out there concerns this tab too.
    if (this.channel) {
      this.channel.onmessage = (event: MessageEvent<TabMessage>) => {
        const message = event.data;
        if (message.type === 'token' && this.session.isAuthenticated()) {
          this.session.setAccessToken(message.token);
        } else if (message.type === 'signed-out' && this.session.isAuthenticated()) {
          this.endLocalSession();
        }
      };
    }
  }

  ngOnDestroy(): void {
    this.channel?.close();
  }

  /** App start: restore the session silently from the refresh cookie (page reloads stay signed in). */
  async restore(): Promise<void> {
    const session = await firstValueFrom(this.repo.restore());
    if (session) this.session.start(session);
  }

  login(credentials: LoginCredentials): Observable<void> {
    return this.repo.login(credentials).pipe(
      tap((session) => this.session.start(session)),
      map(() => undefined),
    );
  }

  /** Chooses a new password; the other sessions of the user end, this one stays. */
  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.repo
      .changePassword(currentPassword, newPassword)
      .pipe(tap(() => this.session.markPasswordChanged()));
  }

  /** Ends this session on the server, then locally. The local session ends even if that fails. */
  logout(): Observable<void> {
    return this.repo.logout().pipe(finalize(() => this.signedOut()));
  }

  /** Ends every session of the user (all devices). */
  logoutAll(): Observable<void> {
    return this.repo.logoutAll().pipe(finalize(() => this.signedOut()));
  }

  /**
   * Gets a new access token, once. Callers arriving while a refresh is running share it. When it
   * fails the user is signed out and sent to the login page.
   */
  refreshAccessToken(): Observable<string> {
    this.inflight ??= this.repo.refresh().pipe(
      tap((token) => {
        this.session.setAccessToken(token);
        this.post({ type: 'token', token });
      }),
      catchError((error: unknown) => {
        this.expire();
        return throwError(() => error);
      }),
      finalize(() => (this.inflight = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.inflight;
  }

  /** The server no longer accepts this session: clear state and go to the login page. */
  private expire(): void {
    this.endLocalSession();
  }

  private signedOut(): void {
    this.post({ type: 'signed-out' });
    this.endLocalSession();
  }

  private endLocalSession(): void {
    this.session.end();
    void this.router.navigateByUrl('/login');
  }

  private post(message: TabMessage): void {
    this.channel?.postMessage(message);
  }
}
