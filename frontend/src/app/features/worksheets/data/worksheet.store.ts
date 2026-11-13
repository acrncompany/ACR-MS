import { Injectable, inject, signal } from '@angular/core';
import { DirectoryStore } from '../../../core/mock/directory.store';
import { todayIso } from '../../../shared/utils/date';
import { WorkSheet } from '../domain/worksheet.models';
import { buildSeedSheets } from './worksheet.seed';

const STORAGE_KEY = 'acr-demo-worksheets-v2';

interface Saved {
  /** Seed dates are relative to "today", so a snapshot from another day is discarded. */
  day: string;
  sheets: WorkSheet[];
}

/**
 * MOCK ONLY: every work sheet, unfiltered. Visibility is applied by the repository. Edits are
 * kept in localStorage so a refresh during a demo does not lose progress. Client credentials are
 * never stored here (they live on the client master and are not persisted at all).
 */
@Injectable({ providedIn: 'root' })
export class WorksheetStore {
  private readonly directory = inject(DirectoryStore);

  readonly all = signal<WorkSheet[]>([]);

  constructor() {
    this.all.set(this.load() ?? buildSeedSheets(this.directory));
  }

  upsert(sheet: WorkSheet): void {
    this.all.update((list) =>
      list.some((s) => s.id === sheet.id)
        ? list.map((s) => (s.id === sheet.id ? sheet : s))
        : [...list, sheet],
    );
    this.save();
  }

  addAll(sheets: WorkSheet[]): void {
    this.all.update((list) => [...list, ...sheets]);
    this.save();
  }

  reset(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable
    }
    this.all.set(buildSeedSheets(this.directory));
  }

  private save(): void {
    try {
      const saved: Saved = { day: todayIso(), sheets: this.all() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // storage unavailable; progress just won't survive a refresh
    }
  }

  private load(): WorkSheet[] | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw) as Saved;
      return saved.day === todayIso() && saved.sheets?.length ? saved.sheets : null;
    } catch {
      return null;
    }
  }
}
