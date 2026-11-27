import { Observable } from 'rxjs';
import { Session } from '../../../core/auth/session.service';
import { LoginCredentials } from './auth.models';

/**
 * Contract for authentication. The tenant is resolved by the backend (subdomain/host),
 * never supplied by the client form.
 */
export abstract class AuthRepository {
  /** Signs in and returns the session (access token plus the signed-in user's profile). */
  abstract login(credentials: LoginCredentials): Observable<Session>;
  /** Exchanges the refresh cookie for a new access token. Errors when it is missing or invalid. */
  abstract refresh(): Observable<string>;
  /** Silent sign-in at app start: refresh, then load the profile. Emits null when signed out. */
  abstract restore(): Observable<Session | null>;
  /** Ends the current session. */
  abstract logout(): Observable<void>;
  /** Ends every session of the user, on all devices. */
  abstract logoutAll(): Observable<void>;
  /** The user chooses their own password (required after an admin set a temporary one). */
  abstract changePassword(currentPassword: string, newPassword: string): Observable<void>;
}
