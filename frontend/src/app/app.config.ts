import {
  ApplicationConfig,
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
import { ThemeService } from './core/theme/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Runtime config must be loaded before anything reads it; theme is applied right after.
    provideAppInitializer(async () => {
      // inject() only works before the first await.
      const config = inject(AppConfigService);
      inject(ThemeService); // instantiate so the saved theme applies at startup
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-rounded');
      await config.load();
    }),
  ],
};
