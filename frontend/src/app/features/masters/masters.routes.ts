import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guard';
import { CLIENTS_ROUTES } from '../clients/clients.routes';

export const MASTERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./presentation/masters-page').then((m) => m.MastersPage),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'clients' },
      { path: 'clients', children: CLIENTS_ROUTES },
      {
        path: 'works',
        canActivate: [permissionGuard],
        data: { permission: 'clients.view' },
        loadComponent: () => import('./presentation/works-page').then((m) => m.WorksPage),
      },
    ],
  },
];
