import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AppConfigService } from '../config/app-config.service';
import { SessionService } from './session.service';

/** Attaches the access token to API calls only. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(SessionService).accessToken();
  const appConfig = inject(AppConfigService);
  // The runtime config request itself runs before the config exists.
  if (!token || !appConfig.isLoaded) return next(req);

  if (req.url.startsWith(appConfig.config.api.baseUrl)) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
  return next(req);
};
