/** Dates are stored as ISO `YYYY-MM-DD` strings (UTC) and only formatted for display. */
const DAY_MS = 86_400_000;

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

/** Indian format (dd/MM/yyyy) when locale is en-IN; follows the configured locale otherwise. */
export function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

/** Date and time in the viewer's time zone, for audit stamps (stored values stay UTC). */
export function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  );
}
