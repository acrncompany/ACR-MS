import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guard';
import { clientsProviders } from './clients.providers';

export const CLIENTS_ROUTES: Routes = [
  {
    path: '',
    providers: clientsProviders,
    children: [
      {
        path: '',
        pathMatch: 'full',
        canActivate: [permissionGuard],
        data: { permission: 'clients.view' },
        loadComponent: () => import('./presentation/clients-page').then((m) => m.ClientsPage),
      },
      // "new" must come before ":id".
      {
        path: 'new',
        canActivate: [permissionGuard],
        data: { permission: 'clients.create' },
        loadComponent: () =>
          import('./presentation/client-form-page').then((m) => m.ClientFormPage),
      },
      {
        path: ':id/edit',
        canActivate: [permissionGuard],
        data: { permission: 'clients.edit' },
        loadComponent: () =>
          import('./presentation/client-form-page').then((m) => m.ClientFormPage),
      },
      {
        path: ':id',
        canActivate: [permissionGuard],
        data: { permission: 'clients.view' },
        loadComponent: () =>
          import('./presentation/client-detail-page').then((m) => m.ClientDetailPage),
      },
    ],
  },
];
