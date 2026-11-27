import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  type CustomDecorator,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppConfig } from '../../../core/config/app-config.js';
import { UnauthorizedError } from '../../../core/errors/app-error.js';
import { AUTH_REQUIRED, AuthIdentity, ClientContext } from '../domain/auth.types.js';

/** Marks a route as reachable without an access token (login, refresh, logout, health). */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Routes a user may still call while they have to change a temporary password (change-password,
 * me, logout). Every other authenticated route answers 403 PASSWORD_CHANGE_REQUIRED.
 */
export const ALLOW_PASSWORD_CHANGE_KEY = 'allowWhilePasswordChangeRequired';
export const AllowWhilePasswordChangeRequired = (): CustomDecorator =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_KEY, true);

/** Which stricter rate limit a route uses. Routes without one use the default limit. */
export const THROTTLE_KIND_KEY = 'authThrottleKind';
export type ThrottleKind = 'login' | 'refresh';
export const AuthThrottle = (kind: ThrottleKind): CustomDecorator =>
  SetMetadata(THROTTLE_KIND_KEY, kind);

/**
 * CSRF defence for cookie-authenticated endpoints, together with the SameSite=Strict cookie:
 * browsers cannot add a custom header cross-site without a CORS preflight, which only the
 * configured frontend origin passes.
 */
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'acr-ms';

export type AuthenticatedRequest = Request & { auth?: AuthIdentity };

/** The verified identity of the caller. Only available on non-public routes. */
export const CurrentAuth = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const auth = ctx.switchToHttp().getRequest<AuthenticatedRequest>().auth;
  if (!auth) throw new UnauthorizedError(AUTH_REQUIRED);
  return auth;
});

export function clientContext(req: Request): ClientContext {
  const userAgent = req.headers['user-agent'];
  return {
    ip: req.ip ?? null,
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 512) : null,
  };
}

/** The refresh token cookie: httpOnly, SameSite=Strict, scoped to the auth path. */
export class RefreshCookie {
  constructor(private readonly config: AppConfig) {}

  private get base() {
    return {
      httpOnly: true,
      // Secure cookies need HTTPS; local development runs on plain HTTP.
      secure: this.config.isProduction,
      sameSite: 'strict' as const,
      path: this.config.get('REFRESH_COOKIE_PATH'),
    };
  }

  read(req: Request): string | undefined {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const value = cookies?.[this.config.get('REFRESH_COOKIE_NAME')];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  set(res: Response, token: string, expiresAt: Date): void {
    res.cookie(this.config.get('REFRESH_COOKIE_NAME'), token, { ...this.base, expires: expiresAt });
  }

  clear(res: Response): void {
    res.clearCookie(this.config.get('REFRESH_COOKIE_NAME'), this.base);
  }
}
