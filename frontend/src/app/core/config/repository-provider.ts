import { Provider, inject } from '@angular/core';
import { AppConfigService } from './app-config.service';

/**
 * Binds an abstract repository to its mock or API implementation based on `mockMode` in the
 * runtime config. This is the only place the choice is made, so every feature switches together.
 * Implementations are constructed inside an injection context, so they may use `inject()`.
 */
export function provideRepository<T>(
  token: abstract new () => T,
  mock: new () => T,
  api: new () => T,
): Provider {
  return {
    provide: token,
    useFactory: (): T => (inject(AppConfigService).config.mockMode ? new mock() : new api()),
  };
}
