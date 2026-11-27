import { Injectable } from '@nestjs/common';
import { UnauthorizedError } from '../../../core/errors/app-error.js';
import { GetUserAccessUseCase } from '../../access/domain/get-user-access.use-case.js';
import { GetUserOrgContextUseCase } from '../../organization/domain/get-user-org-context.use-case.js';
import { GetTenantProfileUseCase } from '../../tenant/domain/get-tenant.use-cases.js';
import { FindUserByIdUseCase } from '../../user/domain/find-user-by-id.use-case.js';
import { AUTH_REQUIRED, AuthIdentity } from './auth.types.js';

export interface MeResult {
  user: {
    id: string;
    name: string;
    email: string;
    employeeCode: string;
    mustChangePassword: boolean;
  };
  position: { id: string; code: string; name: string } | null;
  department: { id: string; code: string; name: string } | null;
  roles: { id: string; key: string; name: string }[];
  permissions: string[];
  /** Sees every record in the tenant (Board). */
  seesAll: boolean;
  branches: { id: string; code: string; name: string }[];
  homeBranchId: string | null;
  tenant: {
    id: string;
    name: string;
    slug: string;
    branding: Record<string, unknown>;
    defaultLocale: string;
  };
}

/** Everything the frontend needs after sign-in. Never includes secrets or the password hash. */
@Injectable()
export class MeUseCase {
  constructor(
    private readonly findUserById: FindUserByIdUseCase,
    private readonly getAccess: GetUserAccessUseCase,
    private readonly getOrgContext: GetUserOrgContextUseCase,
    private readonly getTenant: GetTenantProfileUseCase,
  ) {}

  async execute(identity: AuthIdentity): Promise<MeResult> {
    const user = await this.findUserById.execute(identity.userId);
    if (!user) throw new UnauthorizedError(AUTH_REQUIRED);

    const [access, org, tenant] = await Promise.all([
      this.getAccess.execute(user.id),
      this.getOrgContext.execute(user.id, user.positionId),
      this.getTenant.execute(),
    ]);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        employeeCode: user.employeeCode,
        mustChangePassword: user.mustChangePassword,
      },
      position: org.position && {
        id: org.position.id,
        code: org.position.code,
        name: org.position.name,
      },
      department: org.department,
      roles: access.roles,
      permissions: access.permissions,
      seesAll: org.position?.seesAll ?? false,
      branches: org.branches,
      homeBranchId: org.homeBranchId,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        branding: tenant.branding,
        defaultLocale: tenant.defaultLocale,
      },
    };
  }
}
