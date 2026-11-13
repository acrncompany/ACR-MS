import { Injectable, inject, isDevMode, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { AppConfig } from './app-config.model';

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

  async load(): Promise<void> {
    const raw = await firstValueFrom(this.http.get<Partial<AppConfig>>('assets/config.json'));
    // Anything other than an explicit `true` means real (non-mock) mode.
    const config = { ...raw, mockMode: raw.mockMode === true } as AppConfig;
    this.state.set(config);
    this.title.setTitle(config.branding.productName);
    this.applyBranding(config.branding.cssVariables ?? {});

    if (config.mockMode && !isDevMode()) {
      console.warn(
        'mockMode is enabled in a production build. This must never ship to production.',
      );
    }
  }

  private applyBranding(variables: Record<string, string>): void {
    for (const [name, value] of Object.entries(variables)) {
      if (name.startsWith('--')) {
        document.documentElement.style.setProperty(name, value);
      }
    }
  }
}
