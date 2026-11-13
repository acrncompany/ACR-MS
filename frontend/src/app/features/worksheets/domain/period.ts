import { RecurringFrequency } from '../../clients/domain/client.models';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 2026" for an ISO date. */
export function monthLabel(iso: string): string {
  const date = new Date(iso);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Indian financial year (April to March) that contains the date, e.g. "FY 2026-27". */
export function financialYear(iso: string): string {
  const date = new Date(iso);
  const start = date.getUTCMonth() >= 3 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return `FY ${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** The financial year before the one containing the date. */
export function previousFinancialYear(iso: string): string {
  const date = new Date(iso);
  const start = (date.getUTCMonth() >= 3 ? date.getUTCFullYear() : date.getUTCFullYear() - 1) - 1;
  return `FY ${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/**
 * Label of the quarter that has just ended, e.g. "Q2 FY 2026-27" in October. Only the first
 * month after a quarter end (Jan, Apr, Jul, Oct) has one; other months return null.
 */
export function endedQuarterLabel(iso: string): string | null {
  const date = new Date(iso);
  const month = date.getUTCMonth() + 1;
  // The quarter that ended last month: Jan->Q3, Apr->Q4, Jul->Q1, Oct->Q2 of the running FY.
  const quarters: Record<number, number> = { 1: 3, 4: 4, 7: 1, 10: 2 };
  const quarter = quarters[month];
  if (!quarter) return null;
  const year = date.getUTCFullYear();
  const start = month === 1 || month === 4 ? year - 1 : year;
  return `Q${quarter} FY ${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Period label for a recurring rule in the month of `iso`, or null when none is due. */
export function recurringPeriod(frequency: RecurringFrequency, iso: string): string | null {
  return frequency === 'monthly' ? monthLabel(iso) : endedQuarterLabel(iso);
}
