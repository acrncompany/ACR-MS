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
  | 'hrEmployee';

export const CODE_FORMATS: Readonly<Record<CodeKind, { prefix: string; pad: number }>> = {
  employee: { prefix: 'EMP-', pad: 4 },
  client: { prefix: 'CLI-', pad: 4 },
  organisationType: { prefix: 'ORG-', pad: 4 },
  work: { prefix: 'WRK-', pad: 4 },
  // HR directory (HR > Employees): independent of the staff accounts above, so its own series.
  hrDepartment: { prefix: 'DEP-', pad: 4 },
  hrDesignation: { prefix: 'DSG-', pad: 4 },
  hrEmployee: { prefix: 'HRE-', pad: 4 },
};

export function formatCode(kind: CodeKind, sequence: number): string {
  const { prefix, pad } = CODE_FORMATS[kind];
  return `${prefix}${String(sequence).padStart(pad, '0')}`;
}

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
  return formatCode(kind, value);
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
  return formatCode(kind, (rows[0]?.value ?? 0) + 1);
}
