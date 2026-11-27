import { Injectable } from '@nestjs/common';
import { OrganizationRepository, UserOrgContext } from './organization.repository.js';

/** Position, department and accessible branches of a user. */
@Injectable()
export class GetUserOrgContextUseCase {
  constructor(private readonly organization: OrganizationRepository) {}

  execute(userId: string, positionId: string | null): Promise<UserOrgContext> {
    return this.organization.findUserOrgContext(userId, positionId);
  }
}
