import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, of, switchMap, throwError } from 'rxjs';
import { AppConfigService } from '../config/app-config.service';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

/** Endpoints that authenticate by cookie or credentials, not by access token. */
const CREDENTIAL_ENDPOINT = /\/auth\/(login|refresh|logout|logout-all)(\?|$)/;

function isPasswordChangeRequired(error: HttpErrorResponse): boolean {
  return (
    error.status === 403 &&
    (error.error as { code?: string } | null)?.code === 'PASSWORD_CHANGE_REQUIRED'
  );
}

function withToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Attaches the in-memory access token to API calls. When the API answers 401 it refreshes the
 * token ONCE (parallel requests share that single refresh) and retries the request with the new
 * token. If the refresh fails the session is cleared and the user goes to the login page.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const appConfig = inject(AppConfigService);
  // The runtime config request itself runs before the config exists.
  if (!appConfig.isLoaded) return next(req);

  const isApi = req.url.startsWith(appConfig.config.api.baseUrl);
  // Not our API, a sign-in/refresh/logout call, or a caller that set its own token.
  if (!isApi || CREDENTIAL_ENDPOINT.test(req.url) || req.headers.has('Authorization')) {
    return next(req);
  }

  const session = inject(SessionService);
  const auth = inject(AuthService);
  const router = inject(Router);
  const used = session.accessToken();
  if (!used) return next(req);

  return next(withToken(req, used)).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && isPasswordChangeRequired(error)) {
        // An admin set a temporary password: send the user to choose their own.
        session.markPasswordChangeRequired();
        void router.navigateByUrl('/change-password');
        return throwError(() => error);
      }
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      // Another request (or tab) may already have refreshed while this one was in flight.
      const current = session.accessToken();
      const token$ = current && current !== used ? of(current) : auth.refreshAccessToken();
      return retryWith(req, next, token$);
    }),
  );
};

function retryWith(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  token$: Observable<string>,
): Observable<HttpEvent<unknown>> {
  // The retry is not retried again, so a 401 that persists cannot loop.
  return token$.pipe(switchMap((token) => next(withToken(req, token))));
}
