import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { AppConfig, FEATURES, FeatureKey } from './app-config.model';

/** Runtime configuration loaded from /assets/config.json before the app starts. */
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly http = inject(HttpClient);
  private readonly title = inject(Title);
  private readonly state = signal<AppConfig | null>(null);

  get isLoaded(): boolean {
    return this.state() !== null;
  }

  get config(): AppConfig {
    const value = this.state();
    if (!value) {
      throw new Error('Runtime config accessed before it was loaded');
    }
    return value;
  }

  /** Whether `feature` uses the real backend (listed in `realFeatures`). */
  isReal(feature: FeatureKey): boolean {
    return this.config.realFeatures.includes(feature);
  }

  /** Features that still use mock data (shown as a "Mock data" chip in the shell). */
  get mockFeatures(): FeatureKey[] {
    return FEATURES.filter((feature) => !this.isReal(feature));
  }

  async load(): Promise<void> {
    const raw = await firstValueFrom(this.http.get<Partial<AppConfig>>('assets/config.json'));
    // Unknown names are ignored; anything not listed is a mock feature.
    const realFeatures = (Array.isArray(raw.realFeatures) ? raw.realFeatures : []).filter(
      (feature): feature is FeatureKey => (FEATURES as readonly string[]).includes(feature),
    );
    const config = { ...raw, realFeatures } as AppConfig;
    this.state.set(config);
    this.title.setTitle(config.branding.productName);
    this.applyBranding(config.branding.cssVariables ?? {});
  }

  private applyBranding(variables: Record<string, string>): void {
    for (const [name, value] of Object.entries(variables)) {
      if (name.startsWith('--')) {
        document.documentElement.style.setProperty(name, value);
      }
    }
  }
}
