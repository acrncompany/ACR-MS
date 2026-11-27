import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../core/errors/app-error.js';
import { SessionPolicy, TenantProfile } from './tenant.entity.js';
import { TenantRepository } from './tenant.repository.js';

@Injectable()
export class GetTenantProfileUseCase {
  constructor(private readonly tenants: TenantRepository) {}

  async execute(): Promise<TenantProfile> {
    const profile = await this.tenants.findCurrentProfile();
    if (!profile) throw new NotFoundError('Tenant not found');
    return profile;
  }
}

@Injectable()
export class GetSessionPolicyUseCase {
  constructor(private readonly tenants: TenantRepository) {}

  execute(): Promise<SessionPolicy> {
    return this.tenants.findCurrentSessionPolicy();
  }
}
