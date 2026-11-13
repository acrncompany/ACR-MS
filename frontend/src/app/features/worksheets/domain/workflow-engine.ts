import {
  Actor,
  AssigneeSlot,
  HistoryChange,
  HistoryEntry,
  ReassignPayload,
  RetargetPayload,
  ActionPayload,
  Stamp,
  WorkSheet,
} from './worksheet.models';
import { ActionDef, SectionKey, StageDef, StampTarget, WorkflowConfig } from './workflow.models';

/**
 * Pure workflow rules. Nothing here names a stage: stages, order, permissions and transitions
 * all come from the WorkflowConfig. The mock repository uses it as "the server"; the UI uses it
 * to decide which buttons to show. A real backend must enforce the same rules itself.
 */

export const SLOT_FIELD: Record<AssigneeSlot, 'assignedOpsId' | 'assignedTlId' | 'assignedTmId'> = {
  ops: 'assignedOpsId',
  tl: 'assignedTlId',
  tm: 'assignedTmId',
};

export const SECTION_LABELS: Record<SectionKey, string> = {
  header: 'Header',
  client: 'Client',
  work: 'Work',
  documents: 'Documents',
  filing: 'Filing details',
  tax: 'Tax',
  documentation: 'Documentation',
  delivery: 'Delivery & billing',
};

export function stageDef(config: WorkflowConfig, key: string): StageDef | undefined {
  return config.stages.find((s) => s.key === key);
}

export function stageLabel(config: WorkflowConfig, key: string): string {
  return stageDef(config, key)?.label ?? key;
}

export function isClosed(sheet: WorkSheet, config: WorkflowConfig): boolean {
  return sheet.stage === config.closedStage;
}

export function isOverdue(sheet: WorkSheet, config: WorkflowConfig, today: string): boolean {
  return !isClosed(sheet, config) && !!sheet.targetDate && sheet.targetDate < today;
}

function participants(sheet: WorkSheet): string[] {
  return [sheet.createdById, sheet.assignedOpsId, sheet.assignedTlId, sheet.assignedTmId].filter(
    (id): id is string => !!id,
  );
}

/**
 * Hierarchy visibility. Board (`seesAll`) sees everything; everyone else sees the sheets that
 * involve themselves or anyone below them (so a Team Lead sees the team, the Operations Manager
 * all operations sheets, the General Manager everything). Stages flagged
 * `visibleToStageActors` (intake, delivery) are also open to everyone who acts there.
 */
export function canSee(sheet: WorkSheet, actor: Actor, config: WorkflowConfig): boolean {
  if (actor.seesAll) return true;
  if (participants(sheet).some((id) => actor.subtree.has(id))) return true;
  const stage = stageDef(config, sheet.stage);
  return !!stage?.visibleToStageActors && actor.permissions.includes(stage.permission);
}

/** True when the actor may act at the sheet's current stage. */
export function canActAtStage(sheet: WorkSheet, actor: Actor, config: WorkflowConfig): boolean {
  const stage = stageDef(config, sheet.stage);
  if (!stage || stage.terminal || !actor.permissions.includes(stage.permission)) return false;
  if (actor.seesAll || stage.actor === 'any') return true;
  const assignee = sheet[SLOT_FIELD[stage.actor]];
  return !!assignee && actor.subtree.has(assignee);
}

export function availableActions(
  sheet: WorkSheet,
  actor: Actor,
  config: WorkflowConfig,
): ActionDef[] {
  return canActAtStage(sheet, actor, config) ? (stageDef(config, sheet.stage)?.actions ?? []) : [];
}

export function editableSections(
  sheet: WorkSheet,
  actor: Actor,
  config: WorkflowConfig,
): Set<SectionKey> {
  return canActAtStage(sheet, actor, config)
    ? new Set(stageDef(config, sheet.stage)?.sections ?? [])
    : new Set();
}

function inFlight(sheet: WorkSheet, config: WorkflowConfig): boolean {
  return sheet.stage !== config.firstStage && !isClosed(sheet, config);
}

export function canReassign(sheet: WorkSheet, actor: Actor, config: WorkflowConfig): boolean {
  return inFlight(sheet, config) && actor.permissions.includes(config.reassignPermission);
}

export function canRetarget(sheet: WorkSheet, actor: Actor, config: WorkflowConfig): boolean {
  return inFlight(sheet, config) && actor.permissions.includes(config.retargetPermission);
}

export function getPath(source: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
      source,
    );
}

function isFilled(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== null && value !== undefined;
}

/** Returns a message when the action cannot be performed yet, otherwise null. */
export function validateAction(
  sheet: WorkSheet,
  action: ActionDef,
  payload: ActionPayload,
): string | null {
  const missing = (action.requires ?? []).filter((r) => !isFilled(getPath(sheet, r.path)));
  if (missing.length) return `Fill in: ${missing.map((m) => m.label).join(', ')}.`;
  if (action.commentRequired && !payload.comment?.trim()) return 'A comment is required.';
  if (action.needs?.includes('targetDate') && !payload.targetDate) return 'Set a target date.';
  if (action.needs?.includes('assignee') && !payload.assigneeId) return 'Choose who to assign.';
  return null;
}

export function stamp(actor: Actor, at: string): Stamp {
  return { userId: actor.id, name: actor.name, role: actor.role, at };
}

export function historyEntry(
  id: string,
  actor: Actor,
  at: string,
  entry: Pick<HistoryEntry, 'kind' | 'label'> &
    Partial<Pick<HistoryEntry, 'fromStage' | 'toStage' | 'comment' | 'changes'>>,
): HistoryEntry {
  return {
    id,
    at,
    userId: actor.id,
    userName: actor.name,
    role: actor.role,
    fromStage: null,
    toStage: null,
    comment: '',
    changes: [],
    ...entry,
  };
}

const EMPTY_STEP = { stamp: null, comments: '' };

/** Stage whose action stamps this completion step, or whose decision records the approval. */
function stageOfStep(config: WorkflowConfig, step: StampTarget | 'decision'): StageDef | undefined {
  return config.stages.find((s) =>
    s.actions.some((a) => (step === 'decision' ? !!a.decision : a.stamp === step)),
  );
}

/** Rework/reject: forget the stamps of every step at or after the stage we go back to. */
function clearStepsFrom(sheet: WorkSheet, targetStage: StageDef, config: WorkflowConfig): void {
  const wipe = (step: StampTarget | 'decision'): boolean => {
    const owner = stageOfStep(config, step);
    return !!owner && owner.order >= targetStage.order;
  };
  for (const step of ['finished', 'finalized', 'documented'] as const) {
    if (wipe(step)) sheet.completion[step] = { ...EMPTY_STEP };
  }
  if (wipe('decision')) sheet.officeApproval = { decision: '', stamp: null, comments: '' };
}

export function applyAction(
  source: WorkSheet,
  action: ActionDef,
  payload: ActionPayload,
  actor: Actor,
  now: string,
  config: WorkflowConfig,
  entryId: string,
  nameOf: (userId: string) => string,
): WorkSheet {
  const sheet = structuredClone(source);
  const changes: HistoryChange[] = [];
  const comment = payload.comment?.trim() ?? '';
  const today = now.slice(0, 10);

  if (action.needs?.includes('targetDate') && payload.targetDate) {
    changes.push({
      label: 'Target date',
      from: sheet.targetDate || '—',
      to: payload.targetDate,
    });
    sheet.targetDate = payload.targetDate;
  }
  if (action.slot && payload.assigneeId) {
    const field = SLOT_FIELD[action.slot];
    const slotLabel = config.slots.find((s) => s.slot === action.slot)?.label ?? action.slot;
    changes.push({
      label: slotLabel,
      from: sheet[field] ? nameOf(sheet[field]) : '—',
      to: nameOf(payload.assigneeId),
    });
    sheet[field] = payload.assigneeId;
    if (action.slot === 'ops') {
      sheet.assignedById = actor.id;
      sheet.assignDate = today;
    }
  }
  if (action.stamp) {
    sheet.completion[action.stamp] = { stamp: stamp(actor, now), comments: comment };
  }
  if (action.decision) {
    sheet.officeApproval = {
      decision: action.decision,
      stamp: stamp(actor, now),
      comments: comment,
    };
  }
  const target = stageDef(config, action.to);
  if (action.sendsBack) {
    sheet.reworkCount += 1;
    if (target) clearStepsFrom(sheet, target, config);
  }

  const from = sheet.stage;
  sheet.stage = action.to;
  if (action.to === config.closedStage) sheet.closedAt = now;
  sheet.history.push(
    historyEntry(entryId, actor, now, {
      kind: 'action',
      label: action.label,
      fromStage: from,
      toStage: action.to,
      comment,
      changes,
    }),
  );
  return sheet;
}

export function applyReassign(
  source: WorkSheet,
  payload: ReassignPayload,
  actor: Actor,
  now: string,
  config: WorkflowConfig,
  entryId: string,
  nameOf: (userId: string) => string,
): WorkSheet {
  const sheet = structuredClone(source);
  const field = SLOT_FIELD[payload.slot];
  const label = config.slots.find((s) => s.slot === payload.slot)?.label ?? payload.slot;
  const before = sheet[field];
  sheet[field] = payload.assigneeId;
  sheet.history.push(
    historyEntry(entryId, actor, now, {
      kind: 'reassign',
      label: `Reassigned ${label}`,
      fromStage: sheet.stage,
      toStage: sheet.stage,
      comment: payload.reason.trim(),
      changes: [{ label, from: before ? nameOf(before) : '—', to: nameOf(payload.assigneeId) }],
    }),
  );
  return sheet;
}

export function applyRetarget(
  source: WorkSheet,
  payload: RetargetPayload,
  actor: Actor,
  now: string,
  entryId: string,
): WorkSheet {
  const sheet = structuredClone(source);
  const before = sheet.targetDate;
  sheet.targetDate = payload.targetDate;
  sheet.history.push(
    historyEntry(entryId, actor, now, {
      kind: 'retarget',
      label: 'Re-targeted',
      fromStage: sheet.stage,
      toStage: sheet.stage,
      comment: payload.reason.trim(),
      changes: [{ label: 'Target date', from: before || '—', to: payload.targetDate }],
    }),
  );
  return sheet;
}

/** Copies only the fields of the allowed sections from `draft` into a copy of `source`. */
export function applySectionEdit(
  source: WorkSheet,
  draft: WorkSheet,
  sections: Set<SectionKey>,
): { sheet: WorkSheet; changed: SectionKey[] } {
  const sheet = structuredClone(source);
  const changed: SectionKey[] = [];
  const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

  const copy = (section: SectionKey, apply: () => boolean): void => {
    if (sections.has(section) && apply()) changed.push(section);
  };
  const fields = (keys: (keyof WorkSheet)[]): boolean => {
    let diff = false;
    for (const key of keys) {
      if (!same(sheet[key], draft[key])) {
        (sheet as unknown as Record<string, unknown>)[key] = structuredClone(draft[key]);
        diff = true;
      }
    }
    return diff;
  };

  copy('header', () => fields(['receivedDate', 'reference', 'mobile', 'others', 'contacts']));
  copy('client', () => fields(['clientId']));
  copy('work', () => fields(['workTypeKey', 'period', 'score', 'requirements', 'pendingBills']));
  copy('documents', () => fields(['documents', 'returned']));
  copy('filing', () => fields(['filing']));
  copy('tax', () => fields(['tax']));
  copy('delivery', () => fields(['delivery']));
  copy('documentation', () => {
    const diff =
      !same(sheet.completion.checklist, draft.completion.checklist) ||
      !same(sheet.completion.folderLocations, draft.completion.folderLocations);
    sheet.completion.checklist = structuredClone(draft.completion.checklist);
    sheet.completion.folderLocations = structuredClone(draft.completion.folderLocations);
    return diff;
  });
  return { sheet, changed };
}
