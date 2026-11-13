import { SessionUser } from '../../../core/auth/session.service';
import { DirectoryStore } from '../../../core/mock/directory.store';
import { Actor } from '../domain/worksheet.models';

/** The workflow engine's view of a directory user (used by the seed data). */
export function actorFor(directory: DirectoryStore, userId: string): Actor {
  const user = directory.user(userId);
  const role = user ? directory.roleOfUser(user) : undefined;
  return {
    id: userId,
    name: user?.name ?? '—',
    role: role?.name ?? '',
    roleId: role?.id ?? '',
    seesAll: role?.seesAll ?? false,
    permissions: role ? directory.permissionsOf(role.id) : [],
    subtree: directory.subtreeUserIds(userId),
  };
}

/** The signed-in user's actor. Permissions come from the session, as everywhere in the UI. */
export function actorFromSession(user: SessionUser, directory: DirectoryStore): Actor {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    roleId: user.roleId,
    seesAll: user.seesAll,
    permissions: user.permissions,
    subtree: directory.subtreeUserIds(user.id),
  };
}
