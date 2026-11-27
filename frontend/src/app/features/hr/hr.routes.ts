import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guard';
import { hrProviders } from './hr.providers';

const guard = { canActivate: [permissionGuard], data: { permission: 'hr.view' } };

const personList = () => import('./presentation/people-pages').then((m) => m.PeoplePersonListPage);
const personForm = () => import('./presentation/person-form-page').then((m) => m.PersonFormPage);
const personDetail = () =>
  import('./presentation/person-detail-page').then((m) => m.PersonDetailPage);

export const HR_ROUTES: Routes = [
  {
    path: '',
    providers: hrProviders,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'people' },
      {
        path: 'people',
        ...guard,
        loadComponent: () => import('./presentation/people-hub-page').then((m) => m.PeopleHubPage),
        children: [
          {
            path: '',
            pathMatch: 'full',
            data: { kind: 'employee' },
            loadComponent: () => personList(),
          },
          { path: 'articles', data: { kind: 'article' }, loadComponent: () => personList() },
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
          // Creating needs hr.create; "new" must come before ":id".
          {
            path: 'employees/new',
            canActivate: [permissionGuard],
            data: { permission: 'hr.create', kind: 'employee' },
            loadComponent: () => personForm(),
          },
          {
            path: 'articles/new',
            canActivate: [permissionGuard],
            data: { permission: 'hr.create', kind: 'article' },
            loadComponent: () => personForm(),
          },
          {
            path: 'employees/:id/edit',
            canActivate: [permissionGuard],
            data: { permission: 'hr.edit', kind: 'employee' },
            loadComponent: () => personForm(),
          },
          {
            path: 'articles/:id/edit',
            canActivate: [permissionGuard],
            data: { permission: 'hr.edit', kind: 'article' },
            loadComponent: () => personForm(),
          },
          {
            path: 'employees/:id',
            data: { kind: 'employee' },
            loadComponent: () => personDetail(),
          },
          { path: 'articles/:id', data: { kind: 'article' }, loadComponent: () => personDetail() },
        ],
      },
      // Old address of the People hub.
      { path: 'employees', pathMatch: 'full', redirectTo: 'people' },
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
