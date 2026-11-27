import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenError, UnauthorizedError } from '../../../core/errors/app-error.js';
import { AUTH_REQUIRED } from '../../auth/domain/auth.types.js';
import { ResolveActorUseCase } from '../domain/resolve-actor.use-case.js';
import { ActorRequest, ANY_PERMISSIONS_KEY, REQUIRED_PERMISSIONS_KEY } from './permissions.js';

/**
 * Global guard, after authentication: enforces @RequirePermission / @RequireAnyPermission on the
 * SERVER (the frontend's permission checks are UX only) and attaches the resolved Actor to the
 * request. A route without a permission decorator is not checked here; every business endpoint
 * must declare one.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolveActor: ResolveActorUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const all = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRED_PERMISSIONS_KEY,
      targets,
    );
    const any = this.reflector.getAllAndOverride<string[] | undefined>(
      ANY_PERMISSIONS_KEY,
      targets,
    );
    if (!all?.length && !any?.length) return true;

    const request = context.switchToHttp().getRequest<ActorRequest>();
    if (!request.auth) throw new UnauthorizedError(AUTH_REQUIRED);
    const actor = await this.resolveActor.execute(request.auth);
    request.actor = actor;

    const okAll = !all?.length || all.every((key) => actor.permissions.has(key));
    const okAny = !any?.length || any.some((key) => actor.permissions.has(key));
    if (!okAll || !okAny) throw new ForbiddenError('You do not have permission to do this');
    return true;
  }
}
