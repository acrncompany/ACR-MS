import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guard';
import { clientsProviders } from './clients.providers';

export const CLIENTS_ROUTES: Routes = [
  {
    path: '',
    providers: clientsProviders,
    canActivate: [permissionGuard],
    data: { permission: 'clients.view' },
    loadComponent: () => import('./presentation/clients-page').then((m) => m.ClientsPage),
  },
];
