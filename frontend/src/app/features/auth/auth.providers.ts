import { Provider } from '@angular/core';
import { provideRepository } from '../../core/config/repository-provider';
import { ApiAuthRepository } from './data/api-auth.repository';
import { AuthRepository } from './domain/auth.repository';

export const authProviders: Provider[] = [
  // Authentication only exists against the backend (no mock).
  provideRepository(AuthRepository, 'auth', null, ApiAuthRepository),
];
