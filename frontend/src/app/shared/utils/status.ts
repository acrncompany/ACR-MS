export type StatusTone = 'ok' | 'info' | 'warn' | 'bad' | 'neutral';

const OK = new Set([
  'completed',
  'paid',
  'approved',
  'active',
  'present',
  'won',
  'resolved',
  'filed',
  'accepted',
  'closed',
]);
const INFO = new Set(['in progress', 'open', 'sent', 'negotiation', 'qualified', 'submitted']);
const WARN = new Set(['pending', 'partially paid', 'on leave', 'new', 'draft', 'pending review']);
const BAD = new Set([
  'overdue',
  'rejected',
  'inactive',
  'absent',
  'lost',
  'cancelled',
  'escalated',
]);

/** Maps a status label to a colour tone; anything unknown is neutral. */
export function statusTone(status: string): StatusTone {
  const key = status.toLowerCase();
  if (OK.has(key)) return 'ok';
  if (INFO.has(key)) return 'info';
  if (WARN.has(key)) return 'warn';
  if (BAD.has(key)) return 'bad';
  return 'neutral';
}
