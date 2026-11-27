import {
  ApplicationConfig,
  Injector,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { MatIconRegistry } from '@angular/material/icon';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { AppConfigService } from './core/config/app-config.service';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { DialogChrome } from './core/layout/dialog-chrome';
import { ThemeService } from './core/theme/theme.service';
import { authProviders } from './features/auth/auth.providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Root-level: the HTTP interceptor and AuthService need the auth repository.
    ...authProviders,
    // Dialogs close only through their buttons (not a backdrop click or Escape).
    { provide: MAT_DIALOG_DEFAULT_OPTIONS, useValue: { disableClose: true } },
    // Runtime config must be loaded before anything reads it; theme is applied right after.
    provideAppInitializer(async () => {
      // inject() only works before the first await.
      const config = inject(AppConfigService);
      const injector = inject(Injector);
      inject(ThemeService); // instantiate so the saved theme applies at startup
      inject(DialogChrome).init();
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-rounded');
      await config.load();
      // Restore the session silently from the refresh cookie so a reload keeps the user signed
      // in. Resolved after the config because the auth repository depends on it.
      await injector.get(AuthService).restore();
    }),
  ],
};
