import {
  createParamDecorator,
  SetMetadata,
  type CustomDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { UnauthorizedError } from '../../../core/errors/app-error.js';
import { AUTH_REQUIRED, AuthIdentity } from '../../auth/domain/auth.types.js';
import type { Actor } from '../domain/actor.js';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
export const ANY_PERMISSIONS_KEY = 'anyPermissions';

/** The caller needs ALL of these permission keys (e.g. "clients.edit"). */
export const RequirePermission = (...keys: string[]): CustomDecorator =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, keys);

/** The caller needs AT LEAST ONE of these permission keys. */
export const RequireAnyPermission = (...keys: string[]): CustomDecorator =>
  SetMetadata(ANY_PERMISSIONS_KEY, keys);

export type ActorRequest = Request & { auth?: AuthIdentity; actor?: Actor };

/** The resolved Actor of the caller. Only available on routes that declare a permission. */
export const CurrentActor = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const actor = ctx.switchToHttp().getRequest<ActorRequest>().actor;
  if (!actor) throw new UnauthorizedError(AUTH_REQUIRED);
  return actor;
});
