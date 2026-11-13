import { Provider } from '@angular/core';
import { provideRepository } from '../../core/config/repository-provider';
import { ApiDirectoryRepository } from './data/api-directory.repository';
import { MockDirectoryRepository } from './data/mock-directory.repository';
import { DirectoryRepository } from './domain/directory.repository';

export const adminProviders: Provider[] = [
  provideRepository(DirectoryRepository, MockDirectoryRepository, ApiDirectoryRepository),
];
