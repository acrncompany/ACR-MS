import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { AppError, ForbiddenError, UnauthorizedError } from '../../../core/errors/app-error.js';
import { TenantContext } from '../../../core/tenant/tenant-context.js';
import { AUTH_REQUIRED } from '../domain/auth.types.js';
import { AuthenticateRequestUseCase } from '../domain/authenticate-request.use-case.js';
import {
  ALLOW_PASSWORD_CHANGE_KEY,
  AuthenticatedRequest,
  CSRF_HEADER,
  CSRF_HEADER_VALUE,
  IS_PUBLIC_KEY,
} from './auth-http.js';

/**
 * Global guard: every route needs a valid access token unless it is marked @Public().
 * The tenant context itself is set earlier by the tenant middleware from the HOST (so RLS
 * applies to everything below); this guard only accepts tokens that belong to that tenant.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContext,
    private readonly authenticate: AuthenticateRequestUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerToken(request);
    if (!token || !this.tenantContext.hasTenant()) throw new UnauthorizedError(AUTH_REQUIRED);

    request.auth = await this.authenticate.execute(token, this.tenantContext.getTenantId());
    return true;
  }
}

function bearerToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/**
 * Runs after JwtAuthGuard. While the signed-in user still has a temporary password, only the
 * routes marked @AllowWhilePasswordChangeRequired() work; everything else answers 403.
 */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const auth = context.switchToHttp().getRequest<AuthenticatedRequest>().auth;
    if (!auth?.mustChangePassword) return true;
    const allowed = this.reflector.getAllAndOverride<boolean | undefined>(
      ALLOW_PASSWORD_CHANGE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed) return true;
    throw new AppError(
      'PASSWORD_CHANGE_REQUIRED',
      'You must change your temporary password before continuing',
      403,
    );
  }
}

/** Requires the custom header on cookie-authenticated endpoints (refresh, logout). */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.headers[CSRF_HEADER] !== CSRF_HEADER_VALUE) {
      throw new ForbiddenError('Missing or invalid CSRF header');
    }
    return true;
  }
}

/** Rate limits are counted per host (tenant) and client IP. */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    return Promise.resolve(`${String(req['hostname'])}|${String(req['ip'])}`);
  }
}
