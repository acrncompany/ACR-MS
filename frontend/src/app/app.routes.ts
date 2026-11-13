import { Routes } from '@angular/router';
import { authGuard, guestGuard, homeRedirectGuard, permissionGuard } from './core/auth/auth.guard';
import { shellProviders } from './core/layout/shell.providers';
import { authProviders } from './features/auth/auth.providers';
import { worksheetsProviders } from './features/worksheets/worksheets.providers';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    // Printable work sheet: outside the shell so the sidebar and header never print.
    path: 'print/worksheets/:id',
    canActivate: [authGuard, permissionGuard],
    data: { permission: 'worksheet.view' },
    providers: worksheetsProviders,
    loadComponent: () =>
      import('./features/worksheets/presentation/worksheet-print-page').then(
        (m) => m.WorksheetPrintPage,
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    // AuthRepository is provided here too because the shell signs the user out.
    providers: [...authProviders, ...shellProviders],
    loadComponent: () => import('./core/layout/shell').then((m) => m.Shell),
    children: [
      // "/" goes to the first page the signed-in role may open.
      { path: '', pathMatch: 'full', canActivate: [homeRedirectGuard], children: [] },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'worksheets',
        loadChildren: () =>
          import('./features/worksheets/worksheets.routes').then((m) => m.WORKSHEETS_ROUTES),
      },
      {
        path: 'admin',
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
      {
        path: 'masters',
        loadChildren: () =>
          import('./features/masters/masters.routes').then((m) => m.MASTERS_ROUTES),
      },
      {
        path: 'hr',
        loadChildren: () => import('./features/hr/hr.routes').then((m) => m.HR_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
