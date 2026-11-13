import { Provider } from '@angular/core';
import { provideRepository } from '../../core/config/repository-provider';
import { ApiAuthRepository } from './data/api-auth.repository';
import { MockAuthRepository } from './data/mock-auth.repository';
import { AuthRepository } from './domain/auth.repository';

export const authProviders: Provider[] = [
  provideRepository(AuthRepository, MockAuthRepository, ApiAuthRepository),
];
