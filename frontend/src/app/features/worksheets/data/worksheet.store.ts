import { Injectable, signal } from '@angular/core';
import { todayIso } from '../../../shared/utils/date';
import { WorkSheet } from '../domain/worksheet.models';

const STORAGE_KEY = 'acr-demo-worksheets-v3';

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
  readonly all = signal<WorkSheet[]>([]);

  constructor() {
    // No seeded sheets: clients and staff are real now, so sample sheets would point at nobody.
    this.all.set(this.load() ?? []);
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
    this.all.set([]);
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
