import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, defer, map, of, throwError } from 'rxjs';
import { SessionService } from '../../../core/auth/session.service';
import { todayIso } from '../../../shared/utils/date';
import { ClientRepository } from '../../clients/domain/client.repository';
import { recurringPeriod } from '../domain/period';
import { emptySheet, nextWorkNo } from '../domain/worksheet.factory';
import {
  ActionPayload,
  Actor,
  AssigneeSlot,
  ReassignPayload,
  RetargetPayload,
  WorkSheet,
} from '../domain/worksheet.models';
import {
  Assignee,
  GenerateResult,
  NewWorksheetInput,
  WorksheetRepository,
} from '../domain/worksheet.repository';
import {
  SECTION_LABELS,
  applyAction,
  applyReassign,
  applyRetarget,
  applySectionEdit,
  availableActions,
  canReassign,
  canRetarget,
  canSee,
  editableSections,
  historyEntry,
  validateAction,
} from '../domain/workflow-engine';
import { actorFromSession } from './actors';
import { DOCUMENTATION_CHECKLIST, WORKFLOW_CONFIG, WORK_TYPES } from './workflow.config';
import { WorksheetStore } from './worksheet.store';

let entrySeq = 0;
const newEntryId = (): string => `h-${Date.now()}-${entrySeq++}`;

function fail<T>(message: string): Observable<T> {
  return throwError(() => new Error(message));
}

/**
 * Stands in for the server in mock mode: it applies visibility and the workflow rules itself,
 * so the UI cannot do anything the real backend would refuse.
 */
@Injectable()
export class MockWorksheetRepository extends WorksheetRepository {
  private readonly store = inject(WorksheetStore);
  private readonly session = inject(SessionService);
  private readonly clients = inject(ClientRepository);

  override readonly workflow = signal(WORKFLOW_CONFIG).asReadonly();
  override readonly workTypes = signal(WORK_TYPES).asReadonly();
  override readonly checklistTemplate = DOCUMENTATION_CHECKLIST;

  override readonly actor = computed<Actor | null>(() => {
    const user = this.session.user();
    return user ? actorFromSession(user) : null;
  });

  override readonly sheets = computed(() => {
    const actor = this.actor();
    if (!actor) return [];
    return this.store.all().filter((s) => canSee(s, actor, WORKFLOW_CONFIG));
  });

  nameOf(userId: string | null): string {
    // Only the signed-in user can be named: the mock has no staff directory.
    const me = this.session.user();
    return userId && me?.id === userId ? me.name : '—';
  }

  /** No candidates: assignment needs the real staff directory, which this mock does not have. */
  // The slot is part of the repository contract; this mock has no candidates for any slot.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  assignees(slot: AssigneeSlot): Assignee[] {
    return [];
  }

  create(input: NewWorksheetInput): Observable<WorkSheet> {
    return defer(() => {
      const actor = this.actor();
      if (!actor?.permissions.includes('worksheet.create')) {
        return fail<WorkSheet>('You are not allowed to create work sheets.');
      }
      return of(this.createSheet(input, actor, ''));
    });
  }

  saveSections(draft: WorkSheet): Observable<WorkSheet> {
    return defer(() => {
      const actor = this.actor();
      const current = this.find(draft.id);
      if (!actor || !current) return fail<WorkSheet>('Work sheet not found.');
      const sections = editableSections(current, actor, WORKFLOW_CONFIG);
      if (!sections.size)
        return fail<WorkSheet>('You cannot edit this sheet at its current stage.');
      const { sheet, changed } = applySectionEdit(current, draft, sections);
      if (!changed.length) return of(current);
      sheet.history.push(
        historyEntry(newEntryId(), actor, new Date().toISOString(), {
          kind: 'edit',
          label: `Saved ${changed.map((s) => SECTION_LABELS[s]).join(', ')}`,
          fromStage: sheet.stage,
          toStage: sheet.stage,
        }),
      );
      this.store.upsert(sheet);
      return of(sheet);
    });
  }

  perform(id: string, actionKey: string, payload: ActionPayload): Observable<WorkSheet> {
    return defer(() => {
      const actor = this.actor();
      const current = this.find(id);
      if (!actor || !current) return fail<WorkSheet>('Work sheet not found.');
      const action = availableActions(current, actor, WORKFLOW_CONFIG).find(
        (a) => a.key === actionKey,
      );
      if (!action) return fail<WorkSheet>('You cannot do that at this stage.');
      const problem = validateAction(current, action, payload);
      if (problem) return fail<WorkSheet>(problem);
      if (
        action.slot &&
        payload.assigneeId &&
        !this.assignees(action.slot).some((a) => a.id === payload.assigneeId)
      ) {
        return fail<WorkSheet>('That person is not below you in the hierarchy.');
      }
      const sheet = applyAction(
        current,
        action,
        payload,
        actor,
        new Date().toISOString(),
        WORKFLOW_CONFIG,
        newEntryId(),
        (userId) => this.nameOf(userId),
      );
      this.store.upsert(sheet);
      return of(sheet);
    });
  }

  reassign(id: string, payload: ReassignPayload): Observable<WorkSheet> {
    return defer(() => {
      const actor = this.actor();
      const current = this.find(id);
      if (!actor || !current) return fail<WorkSheet>('Work sheet not found.');
      if (!canReassign(current, actor, WORKFLOW_CONFIG))
        return fail<WorkSheet>('You cannot reassign this sheet.');
      if (!payload.reason.trim()) return fail<WorkSheet>('A reason is required.');
      if (!this.assignees(payload.slot).some((a) => a.id === payload.assigneeId)) {
        return fail<WorkSheet>('That person is not below you in the hierarchy.');
      }
      const sheet = applyReassign(
        current,
        payload,
        actor,
        new Date().toISOString(),
        WORKFLOW_CONFIG,
        newEntryId(),
        (userId) => this.nameOf(userId),
      );
      this.store.upsert(sheet);
      return of(sheet);
    });
  }

  retarget(id: string, payload: RetargetPayload): Observable<WorkSheet> {
    return defer(() => {
      const actor = this.actor();
      const current = this.find(id);
      if (!actor || !current) return fail<WorkSheet>('Work sheet not found.');
      if (!canRetarget(current, actor, WORKFLOW_CONFIG))
        return fail<WorkSheet>('You cannot re-target this sheet.');
      if (!payload.reason.trim()) return fail<WorkSheet>('A reason is required.');
      if (!payload.targetDate) return fail<WorkSheet>('Choose the new target date.');
      const sheet = applyRetarget(current, payload, actor, new Date().toISOString(), newEntryId());
      this.store.upsert(sheet);
      return of(sheet);
    });
  }

  logCredentialReveal(id: string, fieldLabel: string): Observable<void> {
    return defer(() => {
      const actor = this.actor();
      const current = this.find(id);
      if (!actor || !current) return fail<void>('Work sheet not found.');
      if (!actor.permissions.includes('clients.reveal_credentials'))
        return fail<void>('Not allowed.');
      const sheet = structuredClone(current);
      sheet.history.push(
        historyEntry(newEntryId(), actor, new Date().toISOString(), {
          kind: 'credential',
          label: `Revealed client credential: ${fieldLabel}`,
          fromStage: sheet.stage,
          toStage: sheet.stage,
        }),
      );
      this.store.upsert(sheet);
      return of(undefined);
    });
  }

  generateRecurring(): Observable<GenerateResult> {
    return defer(() => {
      const actor = this.actor();
      if (!actor?.permissions.includes('worksheet.create')) {
        return fail<GenerateResult>('You are not allowed to create work sheets.');
      }
      return this.clients.listAll().pipe(
        map((clients) => {
          const today = todayIso();
          const existing = new Set(
            this.store
              .all()
              .map((s) => s.recurringKey)
              .filter(Boolean),
          );
          const created: WorkSheet[] = [];
          let skipped = 0;
          // Deactivated clients get no new recurring sheets.
          for (const client of clients.filter((c) => c.active)) {
            for (const rule of client.recurring) {
              const period = recurringPeriod(rule.frequency, today);
              if (!period) continue;
              const key = `${client.id}|${rule.workTypeKey}|${period}`;
              if (existing.has(key)) {
                skipped += 1;
                continue;
              }
              existing.add(key);
              created.push(
                this.createSheet(
                  {
                    clientId: client.id,
                    workTypeKey: rule.workTypeKey,
                    period,
                    mobile: client.directors[0]?.phone ?? '',
                    contacts: client.directors.map((p) => ({
                      name: p.name,
                      phone: p.phone,
                      email: p.email,
                    })),
                  },
                  actor,
                  key,
                ),
              );
            }
          }
          return { created: created.length, skipped };
        }),
      );
    });
  }

  private find(id: string): WorkSheet | undefined {
    const actor = this.actor();
    const sheet = this.store.all().find((s) => s.id === id);
    return actor && sheet && canSee(sheet, actor, WORKFLOW_CONFIG) ? sheet : undefined;
  }

  /** Adds a new sheet in the first stage. */
  private createSheet(input: NewWorksheetInput, actor: Actor, recurringKey: string): WorkSheet {
    const now = new Date();
    const all = this.store.all();
    const sheet = emptySheet(
      `ws-${Date.now()}-${all.length}`,
      nextWorkNo(all, now.getUTCFullYear()),
      WORKFLOW_CONFIG.firstStage,
      actor.id,
      now.toISOString().slice(0, 10),
      DOCUMENTATION_CHECKLIST,
    );
    sheet.clientId = input.clientId;
    sheet.workTypeKey = input.workTypeKey;
    sheet.period = input.period;
    sheet.mobile = input.mobile ?? '';
    sheet.contacts = input.contacts ?? [];
    sheet.recurringKey = recurringKey;
    sheet.history.push(
      historyEntry(newEntryId(), actor, now.toISOString(), {
        kind: 'create',
        label: recurringKey ? 'Generated from recurring work' : 'Work sheet created',
        toStage: WORKFLOW_CONFIG.firstStage,
      }),
    );
    this.store.upsert(sheet);
    return sheet;
  }
}
