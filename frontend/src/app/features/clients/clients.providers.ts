import { Provider } from '@angular/core';
import { provideRepository } from '../../core/config/repository-provider';
import { ApiClientRepository } from './data/api-client.repository';
import { MockClientRepository } from './data/mock-client.repository';
import { ClientRepository } from './domain/client.repository';

export const clientsProviders: Provider[] = [
  provideRepository(ClientRepository, MockClientRepository, ApiClientRepository),
];
