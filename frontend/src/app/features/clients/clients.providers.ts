import { Provider } from '@angular/core';
import { provideRepository } from '../../core/config/repository-provider';
import { ApiClientRepository } from './data/api-client.repository';
import { ClientRepository } from './domain/client.repository';

export const clientsProviders: Provider[] = [
  // The client master only exists against the backend (no mock).
  provideRepository(ClientRepository, 'clients', null, ApiClientRepository),
];
