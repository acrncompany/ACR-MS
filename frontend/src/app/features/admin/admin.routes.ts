import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guard';
import { adminProviders } from './admin.providers';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    providers: adminProviders,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'organization' },
      {
        path: 'organization',
        canActivate: [permissionGuard],
        data: { permission: 'organization.view' },
        loadComponent: () =>
          import('./presentation/organization-page').then((m) => m.OrganizationPage),
      },
      {
        path: 'users',
        canActivate: [permissionGuard],
        data: { permission: 'users.view' },
        loadComponent: () => import('./presentation/users-page').then((m) => m.UsersPage),
      },
      {
        path: 'roles',
        canActivate: [permissionGuard],
        data: { permission: 'roles.view' },
        loadComponent: () => import('./presentation/roles-page').then((m) => m.RolesPage),
      },
    ],
  },
];
