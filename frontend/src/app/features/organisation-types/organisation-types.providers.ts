import { Provider } from '@angular/core';
import { provideRepository } from '../../core/config/repository-provider';
import { ApiOrganisationTypeRepository } from './data/api-organisation-type.repository';
import { OrganisationTypeRepository } from './domain/organisation-type.repository';

export const organisationTypesProviders: Provider[] = [
  // The organisation type master only exists against the backend (no mock).
  provideRepository(
    OrganisationTypeRepository,
    'organisationTypes',
    null,
    ApiOrganisationTypeRepository,
  ),
];
