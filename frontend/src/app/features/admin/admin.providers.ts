import { Provider } from '@angular/core';
import { provideRepository } from '../../core/config/repository-provider';
import { ApiOrganizationRepository } from './data/api-organization.repository';
import { ApiStaffRepository } from './data/api-staff.repository';
import { OrganizationRepository } from './domain/organization.repository';
import { StaffRepository } from './domain/staff.repository';

// Organization and users only exist against the backend (no mock).
export const adminProviders: Provider[] = [
  provideRepository(OrganizationRepository, 'organization', null, ApiOrganizationRepository),
  provideRepository(StaffRepository, 'users', null, ApiStaffRepository),
];
