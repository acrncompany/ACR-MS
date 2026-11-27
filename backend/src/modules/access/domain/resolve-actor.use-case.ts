import { Injectable } from '@nestjs/common';
import { UnauthorizedError } from '../../../core/errors/app-error.js';
import { AUTH_REQUIRED, AuthIdentity } from '../../auth/domain/auth.types.js';
import { GetUserOrgContextUseCase } from '../../organization/domain/get-user-org-context.use-case.js';
import { FindUserByIdUseCase } from '../../user/domain/find-user-by-id.use-case.js';
import { Actor } from './actor.js';
import { GetUserAccessUseCase } from './get-user-access.use-case.js';

/** Builds the Actor for a verified identity: position, permissions, branches, visibility. */
@Injectable()
export class ResolveActorUseCase {
  constructor(
    private readonly findUser: FindUserByIdUseCase,
    private readonly getAccess: GetUserAccessUseCase,
    private readonly getOrgContext: GetUserOrgContextUseCase,
  ) {}

  async execute(identity: AuthIdentity): Promise<Actor> {
    const user = await this.findUser.execute(identity.userId);
    if (!user) throw new UnauthorizedError(AUTH_REQUIRED);
    const [access, org] = await Promise.all([
      this.getAccess.execute(user.id),
      this.getOrgContext.execute(user.id, user.positionId),
    ]);
    return {
      userId: user.id,
      tenantId: identity.tenantId,
      positionId: user.positionId,
      seesAll: org.position?.seesAll ?? false,
      allBranches: org.position?.allBranches ?? false,
      branchIds: org.branches.map((b) => b.id),
      homeBranchId: org.homeBranchId,
      permissions: new Set(access.permissions),
    };
  }
}
