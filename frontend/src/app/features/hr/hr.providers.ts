import { Provider } from '@angular/core';
import { provideRepository } from '../../core/config/repository-provider';
import { ApiHrRepository } from './data/api-hr.repository';
import { MockHrRepository } from './data/mock-hr.repository';
import { HrRepository } from './domain/hr.repository';

export const hrProviders: Provider[] = [
  provideRepository(HrRepository, MockHrRepository, ApiHrRepository),
];
