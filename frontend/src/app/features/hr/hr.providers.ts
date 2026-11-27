import { Provider } from '@angular/core';
import { provideRepository } from '../../core/config/repository-provider';
import { ApiPeopleDirectoryRepository } from './data/api-people-directory.repository';
import { ApiHrRepository } from './data/api-hr.repository';
import { MockHrRepository } from './data/mock-hr.repository';
import { HrRepository } from './domain/hr.repository';
import { PeopleDirectoryRepository } from './domain/people-directory.repository';

export const hrProviders: Provider[] = [
  provideRepository(HrRepository, 'hr', MockHrRepository, ApiHrRepository),
  // The HR directory (employees, designations, departments) only exists against the backend.
  provideRepository(PeopleDirectoryRepository, 'people', null, ApiPeopleDirectoryRepository),
];
