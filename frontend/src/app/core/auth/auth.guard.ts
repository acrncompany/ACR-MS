import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { NAV_ITEMS } from '../layout/nav-items';
import { SessionService } from './session.service';

/** Signed in. A user who still has a temporary password is sent to choose their own first. */
export const authGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  if (!session.isAuthenticated()) return router.createUrlTree(['/login']);
  return session.user()?.mustChangePassword ? router.createUrlTree(['/change-password']) : true;
};

/** Signed in, without the temporary-password redirect (for the change-password page itself). */
export const signedInGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  return session.isAuthenticated() ? true : inject(Router).createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  return session.isAuthenticated() ? inject(Router).createUrlTree(['/']) : true;
};

/**
 * First page the signed-in user is allowed to open (their landing page). Administration pages are
 * only a landing page when nothing else is allowed, so managers who can add users still land on
 * their work.
 */
export function homeRoute(session: SessionService): string | null {
  const allowed = NAV_ITEMS.filter((item) => session.can(item.permission));
  const work = allowed.find((item) => item.section !== 'Administration');
  return (work ?? allowed[0])?.route ?? null;
}

/**
 * Blocks routes the role may not open. Route `data.permission` is "module.action".
 * UX only: the backend must enforce permissions as well.
 */
export const permissionGuard: CanActivateFn = (route) => {
  const session = inject(SessionService);
  const router = inject(Router);
  const permission = route.data['permission'] as string | undefined;
  if (!permission || session.can(permission)) return true;
  const home = homeRoute(session);
  return home ? router.parseUrl(home) : router.createUrlTree(['/login']);
};

/** Redirects the bare "/" URL to the user's landing page. */
export const homeRedirectGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const home = homeRoute(session);
  return inject(Router).parseUrl(home ?? '/login');
};
