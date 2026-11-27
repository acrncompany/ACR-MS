import { Injectable, computed, signal } from '@angular/core';

export interface SessionBranch {
  id: string;
  code: string;
  name: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  /** EMP-0001... */
  employeeCode?: string;
  /** An admin set a temporary password: the user must choose their own first. */
  mustChangePassword?: boolean;
  roleId: string;
  /** Role display name, e.g. "Finance Officer (Team Lead)". */
  role: string;
  department: string;
  position: string;
  /** Sees every record regardless of the hierarchy (Board). */
  seesAll: boolean;
  /** Permission keys such as "clients.view". */
  permissions: string[];
  /** Branches the user may work in (from the backend). */
  branches?: SessionBranch[];
  /** Tenant display name (from the backend). */
  tenantName?: string;
}

export interface Session {
  user: SessionUser;
  accessToken: string;
}

/**
 * Holds the signed-in session IN MEMORY ONLY. Nothing is written to localStorage or
 * sessionStorage: the access token must not be readable by injected scripts, and a reload
 * restores the session from the httpOnly refresh cookie instead (see AuthService.restore).
 * Knows nothing about how login happens (that is the data layer).
 * Permission checks here are for UX only; the backend must enforce every permission.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly token = signal<string | null>(null);
  private readonly profile = signal<SessionUser | null>(null);

  readonly user = this.profile.asReadonly();
  readonly accessToken = this.token.asReadonly();
  readonly isAuthenticated = computed(() => this.profile() !== null);

  constructor() {
    // Older builds kept the whole session (including the token) in sessionStorage.
    try {
      sessionStorage.removeItem('session-v3');
    } catch {
      // storage may be blocked; nothing to clean up then
    }
  }

  /** `permission` is "module.action", e.g. "clients.edit". */
  can(permission: string): boolean {
    return this.profile()?.permissions.includes(permission) ?? false;
  }

  start(session: Session): void {
    this.token.set(session.accessToken);
    this.profile.set(session.user);
  }

  /** Replaces the access token after a silent refresh; the user stays signed in. */
  setAccessToken(accessToken: string): void {
    this.token.set(accessToken);
  }

  /** After the user chose their own password. */
  markPasswordChanged(): void {
    const user = this.profile();
    if (user) this.profile.set({ ...user, mustChangePassword: false });
  }

  /** The server said a password change is required (403 PASSWORD_CHANGE_REQUIRED). */
  markPasswordChangeRequired(): void {
    const user = this.profile();
    if (user) this.profile.set({ ...user, mustChangePassword: true });
  }

  end(): void {
    this.token.set(null);
    this.profile.set(null);
  }
}
