import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guard';
import { dashboardProviders } from './dashboard.providers';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    providers: dashboardProviders,
    canActivate: [permissionGuard],
    data: { permission: 'dashboard.view' },
    loadComponent: () => import('./presentation/dashboard-page').then((m) => m.DashboardPage),
  },
];
