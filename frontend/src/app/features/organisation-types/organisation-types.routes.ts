import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guard';
import { organisationTypesProviders } from './organisation-types.providers';

export const ORGANISATION_TYPES_ROUTES: Routes = [
  {
    path: '',
    providers: organisationTypesProviders,
    canActivate: [permissionGuard],
    data: { permission: 'clients.view' },
    loadComponent: () =>
      import('./presentation/organisation-types-page').then((m) => m.OrganisationTypesPage),
  },
];
