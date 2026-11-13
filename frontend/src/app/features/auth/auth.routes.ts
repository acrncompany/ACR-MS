import { Routes } from '@angular/router';
import { authProviders } from './auth.providers';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    providers: authProviders,
    loadComponent: () => import('./presentation/login-page').then((m) => m.LoginPage),
  },
];
