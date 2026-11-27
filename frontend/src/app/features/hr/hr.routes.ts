import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guard';
import { hrProviders } from './hr.providers';

const guard = { canActivate: [permissionGuard], data: { permission: 'hr.view' } };

export const HR_ROUTES: Routes = [
  {
    path: '',
    providers: hrProviders,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'employees' },
      {
        path: 'employees',
        ...guard,
        loadComponent: () => import('./presentation/people-hub-page').then((m) => m.PeopleHubPage),
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () =>
              import('./presentation/people-pages').then((m) => m.PeopleEmployeesPage),
          },
          {
            path: 'designations',
            loadComponent: () =>
              import('./presentation/people-pages').then((m) => m.PeopleDesignationsPage),
          },
          {
            path: 'departments',
            loadComponent: () =>
              import('./presentation/people-pages').then((m) => m.PeopleDepartmentsPage),
          },
        ],
      },
      {
        path: 'attendance',
        ...guard,
        loadComponent: () => import('./presentation/hr-pages').then((m) => m.AttendancePage),
      },
      {
        path: 'leave',
        ...guard,
        loadComponent: () => import('./presentation/hr-pages').then((m) => m.LeavePage),
      },
    ],
  },
];
