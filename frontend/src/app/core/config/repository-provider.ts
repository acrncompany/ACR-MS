import { Provider, inject } from '@angular/core';
import { FeatureKey } from './app-config.model';
import { AppConfigService } from './app-config.service';

/**
 * Binds an abstract repository to its real (API) or mock implementation per FEATURE, using
 * `realFeatures` in the runtime config. This is the only place the choice is made. Implementations
 * are constructed inside an injection context, so they may use `inject()`.
 *
 * A feature without a mock class (`mock` = null) is always real: it exists only against the
 * backend. Listing it in `realFeatures` is still how the config documents it.
 */
export function provideRepository<T>(
  token: abstract new () => T,
  feature: FeatureKey,
  mock: (new () => T) | null,
  api: new () => T,
): Provider {
  return {
    provide: token,
    useFactory: (): T => {
      const config = inject(AppConfigService);
      if (config.isReal(feature) || !mock) return new api();
      return new mock();
    },
  };
}
