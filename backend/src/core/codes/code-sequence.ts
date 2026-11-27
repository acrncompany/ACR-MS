import type { TenantTransaction } from '../database/prisma.service.js';

/**
 * Permanent codes for people and clients: prefix + zero-padded number. The format lives ONLY here
 * (the frontend mirrors it in `core/codes/code-format.ts` for display and validation).
 *
 * A code says NOTHING about department, position or level (no "FIN-TM-01"), is unique per tenant,
 * is issued once at creation, never changes and is never reused, even after a deactivation or a
 * delete of a row created by mistake.
 */
export type CodeKind =
  | 'employee'
  | 'client'
  | 'organisationType'
  | 'work'
  | 'hrDepartment'
  | 'hrDesignation'
  | 'hrPerson';

export const CODE_FORMATS: Readonly<Record<CodeKind, { prefix: string; pad: number }>> = {
  employee: { prefix: 'EMP-', pad: 4 },
  client: { prefix: 'CLI-', pad: 4 },
  organisationType: { prefix: 'ORG-', pad: 4 },
  work: { prefix: 'WRK-', pad: 4 },
  // HR directory (HR > Employees): independent of the staff accounts above, so its own series.
  hrDepartment: { prefix: 'DEP-', pad: 4 },
  hrDesignation: { prefix: 'DSG-', pad: 4 },
  // People > Employees and Articles share ONE series, e.g. ACR-0001. The prefix is the tenant's
  // (its slug, upper case), never branch, department or type: a transfer between branches does
  // not change a code. See `tenantCodePrefix`.
  hrPerson: { prefix: '', pad: 4 },
};

export function formatCode(kind: CodeKind, sequence: number, prefix?: string): string {
  const format = CODE_FORMATS[kind];
  return `${prefix ?? format.prefix}${String(sequence).padStart(format.pad, '0')}`;
}

/**
 * The tenant's code prefix ("ACR-" for tenant slug "acr"): the slug without punctuation, upper
 * case, at most 10 characters. Row-level security limits the lookup to the current tenant.
 */
export async function tenantCodePrefix(tx: TenantTransaction): Promise<string> {
  const rows = await tx.$queryRaw<
    { prefix: string }[]
  >`SELECT left(upper(regexp_replace(slug, '[^a-zA-Z0-9]', '', 'g')), 10) AS prefix FROM tenants WHERE id = app_current_tenant()`;
  const prefix = rows[0]?.prefix;
  if (!prefix) throw new Error('Could not resolve the tenant code prefix');
  return `${prefix}-`;
}

const prefixFor = async (tx: TenantTransaction, kind: CodeKind): Promise<string | undefined> =>
  kind === 'hrPerson' ? tenantCodePrefix(tx) : undefined;

/**
 * Issues the next code of `kind` for the current tenant. MUST run inside the transaction that
 * inserts the row: `next_code_value()` is one atomic upsert-and-increment on `code_sequences`
 * (row lock), never "count + 1", so parallel creates get different numbers and a number that was
 * issued is never handed out again. Unique (tenantId, code) constraints are NOT partial, so a
 * code also stays reserved after a soft delete.
 */
export async function issueCode(tx: TenantTransaction, kind: CodeKind): Promise<string> {
  const rows = await tx.$queryRaw<{ value: number }[]>`SELECT next_code_value(${kind}) AS value`;
  const value = rows[0]?.value;
  if (typeof value !== 'number') throw new Error('Could not issue a code');
  return formatCode(kind, value, await prefixFor(tx, kind));
}

/**
 * The code the NEXT create will most likely get, for showing it in an "add" form. Read-only: it
 * reserves nothing and does not change the counter, so it is only a preview (another create may take
 * it first). The real code is always the one `issueCode` returns inside the creating transaction.
 */
export async function peekNextCode(tx: TenantTransaction, kind: CodeKind): Promise<string> {
  // Row-level security limits this to the current tenant's counter.
  const rows = await tx.$queryRaw<
    { value: number }[]
  >`SELECT "lastValue" AS value FROM code_sequences WHERE kind = ${kind}`;
  return formatCode(kind, (rows[0]?.value ?? 0) + 1, await prefixFor(tx, kind));
}
