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
        loadComponent: () => import('./presentation/hr-pages').then((m) => m.EmployeesPage),
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
