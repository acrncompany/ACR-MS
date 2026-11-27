import { SessionUser } from '../../../core/auth/session.service';
import { Actor } from '../domain/worksheet.models';

/**
 * The signed-in user's actor for the (mock) workflow engine. Permissions come from the session,
 * as everywhere in the UI. The mock knows no reporting lines (staff live in the real backend), so
 * the visible subtree is just the user; Board and GM (`seesAll`) still see everything.
 */
export function actorFromSession(user: SessionUser): Actor {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    roleId: user.roleId,
    seesAll: user.seesAll,
    permissions: user.permissions,
    subtree: new Set([user.id]),
  };
}
