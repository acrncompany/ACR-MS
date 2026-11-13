import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.initialMode());

  constructor() {
    effect(() => {
      const mode = this.mode();
      document.documentElement.classList.toggle('theme-dark', mode === 'dark');
      // AG Grid switches its derived colours with this attribute.
      document.body.dataset['agThemeMode'] = mode;
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // storage unavailable; theme just won't persist
      }
    });
  }

  toggle(): void {
    this.mode.update((m) => (m === 'dark' ? 'light' : 'dark'));
  }

  private initialMode(): ThemeMode {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // ignore
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
