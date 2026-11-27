import { Routes } from '@angular/router';
import { CLIENTS_ROUTES } from '../clients/clients.routes';
import { ORGANISATION_TYPES_ROUTES } from '../organisation-types/organisation-types.routes';
import { WORKS_ROUTES } from '../works/works.routes';

export const MASTERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./presentation/masters-page').then((m) => m.MastersPage),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'clients' },
      { path: 'clients', children: CLIENTS_ROUTES },
      { path: 'works', children: WORKS_ROUTES },
      { path: 'organisations', children: ORGANISATION_TYPES_ROUTES },
    ],
  },
];
