import { Injectable, computed, signal } from '@angular/core';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  roleId: string;
  /** Role display name, e.g. "Finance Officer (Team Lead)". */
  role: string;
  department: string;
  position: string;
  /** Sees every record regardless of the hierarchy (Board). */
  seesAll: boolean;
  /** Permission keys such as "clients.view". */
  permissions: string[];
}

export interface Session {
  user: SessionUser;
  accessToken: string;
}

const STORAGE_KEY = 'session-v3';

/**
 * Holds the signed-in session. Knows nothing about how login happens (that is the data layer).
 * Permission checks here are for UX only; the backend must enforce every permission.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly state = signal<Session | null>(this.restore());

  readonly user = computed(() => this.state()?.user ?? null);
  readonly accessToken = computed(() => this.state()?.accessToken ?? null);
  readonly isAuthenticated = computed(() => this.state() !== null);

  /** `permission` is "module.action", e.g. "clients.edit". */
  can(permission: string): boolean {
    return this.state()?.user.permissions.includes(permission) ?? false;
  }

  start(session: Session): void {
    this.state.set(session);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // ignore
    }
  }

  end(): void {
    this.state.set(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  private restore(): Session | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const session = raw ? (JSON.parse(raw) as Session) : null;
      // Sessions saved by an older build lack roleId; treat them as signed out.
      return session?.user.roleId ? session : null;
    } catch {
      return null;
    }
  }
}
