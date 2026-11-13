import { Observable } from 'rxjs';
import { Session } from '../../../core/auth/session.service';
import { DemoAccount, LoginCredentials } from './auth.models';

/**
 * Contract for authentication. The tenant is resolved by the backend (subdomain/host),
 * never supplied by the client form.
 */
export abstract class AuthRepository {
  /** Quick-login shortcuts for the login page. Only mock repositories provide any. */
  readonly demoAccounts: readonly DemoAccount[] = [];

  abstract login(credentials: LoginCredentials): Observable<Session>;
  abstract logout(): Observable<void>;
}
