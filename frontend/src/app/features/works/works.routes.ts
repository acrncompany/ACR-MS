import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guard';
import { worksProviders } from './works.providers';

export const WORKS_ROUTES: Routes = [
  {
    path: '',
    providers: worksProviders,
    canActivate: [permissionGuard],
    data: { permission: 'clients.view' },
    loadComponent: () => import('./presentation/works-page').then((m) => m.WorksPage),
  },
];
