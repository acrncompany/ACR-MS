import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guard';
import { worksheetsProviders } from './worksheets.providers';

const guard = { canActivate: [permissionGuard], data: { permission: 'worksheet.view' } };

export const WORKSHEETS_ROUTES: Routes = [
  {
    path: '',
    providers: worksheetsProviders,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'list' },
      // The old "waiting for me" page now lives on the dashboard.
      { path: 'my-work', pathMatch: 'full', redirectTo: '/dashboard' },
      {
        path: 'list',
        ...guard,
        loadComponent: () =>
          import('./presentation/worksheet-list-page').then((m) => m.WorksheetListPage),
      },
      {
        path: ':id',
        ...guard,
        loadComponent: () =>
          import('./presentation/worksheet-detail-page').then((m) => m.WorksheetDetailPage),
      },
    ],
  },
];
