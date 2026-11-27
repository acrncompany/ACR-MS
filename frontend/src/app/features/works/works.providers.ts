import { Provider } from '@angular/core';
import { provideRepository } from '../../core/config/repository-provider';
import { ApiWorkRepository } from './data/api-work.repository';
import { WorkRepository } from './domain/work.repository';

export const worksProviders: Provider[] = [
  // The works master only exists against the backend (no mock).
  provideRepository(WorkRepository, 'works', null, ApiWorkRepository),
];
