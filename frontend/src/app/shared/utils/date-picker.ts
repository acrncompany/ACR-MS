import { Provider, inject } from '@angular/core';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  MatDateFormats,
  NativeDateAdapter,
} from '@angular/material/core';
import { AppConfigService } from '../../core/config/app-config.service';

/** Typed dates are read as day/month/year (the app's Indian format), not as month/day/year. */
class DayFirstDateAdapter extends NativeDateAdapter {
  override parse(value: unknown): Date | null {
    if (typeof value !== 'string') return super.parse(value);
    const text = value.trim();
    if (!text) return null;
    const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
    if (!match) return new Date(NaN);
    const [, day, month, year] = match.map(Number);
    const date = new Date(year, month - 1, day);
    // Reject 31/02/2026 and the like (the Date constructor would roll them over).
    return date.getMonth() === month - 1 && date.getDate() === day ? date : new Date(NaN);
  }
}

/** Shown as dd/MM/yyyy; the picker itself follows the configured locale. */
const DAY_FIRST_FORMATS: MatDateFormats = {
  parse: { dateInput: null },
  display: {
    dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' },
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' },
  },
};

/**
 * Providers for a component that uses Material datepickers: dd/MM/yyyy display, day-first
 * typing, locale from the runtime config. Add to the component's `providers`.
 */
export function provideDayFirstDatepicker(): Provider[] {
  return [
    { provide: MAT_DATE_LOCALE, useFactory: () => inject(AppConfigService).config.locale.locale },
    { provide: DateAdapter, useClass: DayFirstDateAdapter, deps: [MAT_DATE_LOCALE] },
    { provide: MAT_DATE_FORMATS, useValue: DAY_FIRST_FORMATS },
  ];
}

/** Stored dates are ISO `YYYY-MM-DD` strings (UTC calendar day). Pickers work with local Dates. */
export function isoToDate(iso: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

export function dateToIso(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
