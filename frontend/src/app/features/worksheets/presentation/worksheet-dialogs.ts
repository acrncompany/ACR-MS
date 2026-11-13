import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { todayIso } from '../../../shared/utils/date';
import { Client, RecurringFrequency, RecurringRule } from '../../clients/domain/client.models';
import { ClientRepository } from '../../clients/domain/client.repository';
import { endedQuarterLabel, monthLabel, previousFinancialYear } from '../domain/period';
import {
  ActionPayload,
  AssigneeSlot,
  ReassignPayload,
  RetargetPayload,
  WorkType,
} from '../domain/worksheet.models';
import { Assignee, NewWorksheetInput } from '../domain/worksheet.repository';
import { ActionDef } from '../domain/workflow.models';
import { WsSelect, WsText } from './ws-fields';

const DIALOG_STYLES = `
  .content {
    display: grid;
    gap: 0.9rem;
    width: min(28rem, 82vw);
    padding-top: 0.4rem !important;
  }
  .sub {
    margin: 0;
    color: var(--mat-sys-on-surface-variant);
  }
  .error {
    margin: 0;
    color: var(--mat-sys-error);
  }
`;

// ---------------------------------------------------------------- stage action

export interface ActionDialogData {
  workNo: string;
  title: string;
  action: ActionDef;
  slotLabel: string;
  assignees: Assignee[];
  defaultTarget: string;
}

/** Collects what a stage action needs: assignee, target date and/or a comment. */
@Component({
  selector: 'app-action-dialog',
  imports: [MatButtonModule, MatDialogModule, WsSelect, WsText],
  template: `
    <h2 mat-dialog-title>{{ data.action.label }}</h2>
    <mat-dialog-content class="content">
      <p class="sub">{{ data.workNo }} · {{ data.title }}</p>
      @if (needsAssignee) {
        @if (data.assignees.length) {
          <app-ws-select
            [label]="data.slotLabel"
            [options]="options"
            [allowEmpty]="false"
            [(value)]="assigneeId"
          />
        } @else {
          <p class="error" role="alert">There is nobody below you to assign this to.</p>
        }
      }
      @if (needsTarget) {
        <app-ws-text label="Target date" type="date" [(value)]="targetDate" />
      }
      <app-ws-text
        [label]="data.action.commentRequired ? 'Comment (required)' : 'Comment (optional)'"
        type="textarea"
        [(value)]="comment"
      />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancel</button>
      <button mat-flat-button type="button" [disabled]="!valid()" (click)="confirm()">
        {{ data.action.label }}
      </button>
    </mat-dialog-actions>
  `,
  styles: DIALOG_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionDialog {
  protected readonly data = inject<ActionDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ActionDialog, ActionPayload>);

  protected readonly needsAssignee = !!this.data.action.needs?.includes('assignee');
  protected readonly needsTarget = !!this.data.action.needs?.includes('targetDate');
  protected readonly options = this.data.assignees.map((a) => ({ value: a.id, label: a.name }));
  protected readonly assigneeId = signal(this.data.assignees[0]?.id ?? '');
  protected readonly targetDate = signal(this.data.defaultTarget);
  protected readonly comment = signal('');

  protected readonly valid = computed(
    () =>
      (!this.needsAssignee || !!this.assigneeId()) &&
      (!this.needsTarget || !!this.targetDate()) &&
      (!this.data.action.commentRequired || !!this.comment().trim()),
  );

  protected confirm(): void {
    if (!this.valid()) return;
    this.ref.close({
      comment: this.comment().trim(),
      targetDate: this.needsTarget ? this.targetDate() : undefined,
      assigneeId: this.needsAssignee ? this.assigneeId() : undefined,
    });
  }
}

// ------------------------------------------------------------------- reassign

export interface ReassignSlotOption {
  slot: AssigneeSlot;
  label: string;
  current: string;
  currentId: string | null;
  candidates: Assignee[];
}

export interface ReassignDialogData {
  workNo: string;
  slots: ReassignSlotOption[];
}

@Component({
  selector: 'app-reassign-dialog',
  imports: [MatButtonModule, MatDialogModule, WsSelect, WsText],
  template: `
    <h2 mat-dialog-title>Reassign</h2>
    <mat-dialog-content class="content">
      <p class="sub">{{ data.workNo }} · the old and new person are recorded with your reason.</p>
      <app-ws-select
        label="Who to change"
        [options]="slotOptions"
        [allowEmpty]="false"
        [(value)]="slot"
      />
      <p class="sub">Currently: {{ selected().current }}</p>
      <app-ws-select
        label="New assignee"
        [options]="candidateOptions()"
        [allowEmpty]="false"
        [(value)]="assigneeId"
      />
      <app-ws-text label="Reason (required)" type="textarea" [(value)]="reason" />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancel</button>
      <button mat-flat-button type="button" [disabled]="!valid()" (click)="confirm()">
        Reassign
      </button>
    </mat-dialog-actions>
  `,
  styles: DIALOG_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReassignDialog {
  protected readonly data = inject<ReassignDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ReassignDialog, ReassignPayload>);

  protected readonly slotOptions = this.data.slots.map((s) => ({ value: s.slot, label: s.label }));
  protected readonly slot = signal<string>(this.data.slots[0]?.slot ?? '');
  protected readonly selected = computed(
    () => this.data.slots.find((s) => s.slot === this.slot()) ?? this.data.slots[0],
  );
  protected readonly candidateOptions = computed(() =>
    this.selected()
      .candidates.filter((c) => c.id !== this.selected().currentId)
      .map((c) => ({ value: c.id, label: c.name })),
  );
  protected readonly assigneeId = signal('');
  protected readonly reason = signal('');
  protected readonly valid = computed(
    () =>
      this.candidateOptions().some((o) => o.value === this.assigneeId()) && !!this.reason().trim(),
  );

  protected confirm(): void {
    if (!this.valid()) return;
    this.ref.close({
      slot: this.selected().slot,
      assigneeId: this.assigneeId(),
      reason: this.reason().trim(),
    });
  }
}

// ------------------------------------------------------------------ re-target

export interface RetargetDialogData {
  workNo: string;
  current: string;
}

@Component({
  selector: 'app-retarget-dialog',
  imports: [MatButtonModule, MatDialogModule, WsText],
  template: `
    <h2 mat-dialog-title>Re-target</h2>
    <mat-dialog-content class="content">
      <p class="sub">
        {{ data.workNo }} · current target {{ data.current || 'not set' }}. The old and new date are
        recorded with your reason.
      </p>
      <app-ws-text label="New target date" type="date" [(value)]="targetDate" />
      <app-ws-text label="Reason (required)" type="textarea" [(value)]="reason" />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancel</button>
      <button mat-flat-button type="button" [disabled]="!valid()" (click)="confirm()">
        Re-target
      </button>
    </mat-dialog-actions>
  `,
  styles: DIALOG_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RetargetDialog {
  protected readonly data = inject<RetargetDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<RetargetDialog, RetargetPayload>);

  protected readonly targetDate = signal('');
  protected readonly reason = signal('');
  protected readonly valid = computed(() => !!this.targetDate() && !!this.reason().trim());

  protected confirm(): void {
    if (this.valid()) {
      this.ref.close({ targetDate: this.targetDate(), reason: this.reason().trim() });
    }
  }
}

// ------------------------------------------------------------------ new sheet

export interface NewSheetDialogData {
  clients: Client[];
  workTypes: WorkType[];
}

function suggestedPeriod(type: WorkType | undefined): string {
  const today = todayIso();
  switch (type?.periodKind) {
    case 'month':
      return monthLabel(today);
    case 'fy':
      return previousFinancialYear(today);
    case 'quarter':
      return endedQuarterLabel(today) ?? '';
    default:
      return '';
  }
}

@Component({
  selector: 'app-new-sheet-dialog',
  imports: [MatButtonModule, MatDialogModule, WsSelect, WsText],
  template: `
    <h2 mat-dialog-title>New work sheet</h2>
    <mat-dialog-content class="content">
      <p class="sub">
        Pick the client and the work. You can fill in the rest on the sheet before submitting it.
      </p>
      <app-ws-select
        label="Client"
        [options]="clientOptions"
        [allowEmpty]="false"
        [(value)]="clientId"
      />
      <app-ws-select
        label="Nature of work"
        [options]="typeOptions"
        [allowEmpty]="false"
        [value]="workTypeKey()"
        (valueChange)="onType($event)"
      />
      <app-ws-text label="Period / year" [(value)]="period" />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancel</button>
      <button mat-flat-button type="button" [disabled]="!valid()" (click)="confirm()">
        Create sheet
      </button>
    </mat-dialog-actions>
  `,
  styles: DIALOG_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewSheetDialog {
  protected readonly data = inject<NewSheetDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<NewSheetDialog, NewWorksheetInput>);

  protected readonly clientOptions = this.data.clients.map((c) => ({ value: c.id, label: c.name }));
  protected readonly typeOptions = this.data.workTypes.map((t) => ({
    value: t.key,
    label: t.label,
  }));
  protected readonly clientId = signal('');
  protected readonly workTypeKey = signal('');
  protected readonly period = signal('');
  protected readonly valid = computed(
    () => !!this.clientId() && !!this.workTypeKey() && !!this.period().trim(),
  );

  protected onType(key: string): void {
    this.workTypeKey.set(key);
    this.period.set(suggestedPeriod(this.data.workTypes.find((t) => t.key === key)));
  }

  protected confirm(): void {
    const client = this.data.clients.find((c) => c.id === this.clientId());
    if (!client || !this.valid()) return;
    this.ref.close({
      clientId: client.id,
      workTypeKey: this.workTypeKey(),
      period: this.period().trim(),
      mobile: client.principals[0]?.mobile ?? '',
      contacts: client.principals.map((p) => ({ name: p.name, phone: p.mobile, email: '' })),
    });
  }
}

// ------------------------------------------------------------ recurring setup

export interface RecurringDialogData {
  clients: Client[];
  workTypes: WorkType[];
  /** Called after any change so the caller can reload its client list. */
  onChanged: () => void;
}

/** Which clients get a sheet generated automatically each period. */
@Component({
  selector: 'app-recurring-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, WsSelect],
  template: `
    <h2 mat-dialog-title>Recurring work</h2>
    <mat-dialog-content class="rec">
      <p class="sub">
        "Generate this month's sheets" creates one sheet per client and period for the work listed
        here. Quarterly work is generated in the month after the quarter ends.
      </p>
      @for (client of clients(); track client.id) {
        <section class="client">
          <h3>{{ client.name }}</h3>
          <div class="rules">
            @for (rule of client.recurring; track rule.workTypeKey + rule.frequency) {
              <span class="chip">
                {{ typeLabel(rule.workTypeKey) }} · {{ rule.frequency }}
                <button
                  type="button"
                  class="x"
                  [attr.aria-label]="'Remove ' + typeLabel(rule.workTypeKey)"
                  (click)="remove(client, rule)"
                >
                  <mat-icon>close</mat-icon>
                </button>
              </span>
            } @empty {
              <span class="none">No recurring work</span>
            }
          </div>
          <div class="add">
            <app-ws-select
              label="Work"
              [options]="typeOptions"
              [value]="draftType()[client.id] ?? ''"
              (valueChange)="setDraftType(client.id, $event)"
            />
            <app-ws-select
              label="Frequency"
              [options]="frequencies"
              [allowEmpty]="false"
              [value]="draftFrequency()[client.id] ?? 'monthly'"
              (valueChange)="setDraftFrequency(client.id, $event)"
            />
            <button
              mat-stroked-button
              type="button"
              [disabled]="!draftType()[client.id]"
              (click)="add(client)"
            >
              Add
            </button>
          </div>
        </section>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Done</button>
    </mat-dialog-actions>
  `,
  styles: `
    .rec {
      display: grid;
      gap: 0.75rem;
      width: min(44rem, 90vw);
    }
    .sub {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .client {
      padding: 0.6rem 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    h3 {
      margin: 0 0 0.4rem;
      font: var(--mat-sys-title-small);
    }
    .rules {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 0.5rem;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      padding: 0 0.3rem 0 0.7rem;
      border-radius: 999px;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font: var(--mat-sys-label-medium);
      line-height: 1.7rem;
    }
    .x {
      display: inline-grid;
      place-items: center;
      width: 1.5rem;
      height: 1.5rem;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    .x mat-icon {
      width: 1rem;
      height: 1rem;
      font-size: 1rem;
    }
    .none {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .add {
      display: grid;
      grid-template-columns: 1fr 9rem auto;
      gap: 0.5rem;
      align-items: center;
    }
    @media (max-width: 40rem) {
      .add {
        grid-template-columns: 1fr;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurringDialog {
  protected readonly data = inject<RecurringDialogData>(MAT_DIALOG_DATA);
  private readonly repo = inject(ClientRepository);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly clients = signal(this.data.clients);
  protected readonly typeOptions = this.data.workTypes
    .filter((t) => t.periodKind !== 'text')
    .map((t) => ({ value: t.key, label: t.label }));
  protected readonly frequencies = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
  ];
  protected readonly draftType = signal<Record<string, string>>({});
  protected readonly draftFrequency = signal<Record<string, string>>({});

  protected typeLabel(key: string): string {
    return this.data.workTypes.find((t) => t.key === key)?.label ?? key;
  }

  protected setDraftType(clientId: string, value: string): void {
    this.draftType.update((all) => ({ ...all, [clientId]: value }));
  }

  protected setDraftFrequency(clientId: string, value: string): void {
    this.draftFrequency.update((all) => ({ ...all, [clientId]: value }));
  }

  protected add(client: Client): void {
    const workTypeKey = this.draftType()[client.id];
    const frequency = (this.draftFrequency()[client.id] ?? 'monthly') as RecurringFrequency;
    if (!workTypeKey) return;
    const rules = [
      ...client.recurring.filter((r) => r.workTypeKey !== workTypeKey),
      { workTypeKey, frequency },
    ];
    this.save(client, rules);
    this.setDraftType(client.id, '');
  }

  protected remove(client: Client, rule: RecurringRule): void {
    this.save(
      client,
      client.recurring.filter((r) => r !== rule),
    );
  }

  private save(client: Client, rules: RecurringRule[]): void {
    this.repo.updateRecurring(client.id, rules).subscribe({
      next: () => {
        this.clients.update((list) =>
          list.map((c) => (c.id === client.id ? { ...c, recurring: rules } : c)),
        );
        this.data.onChanged();
      },
      error: (e: Error) => this.snackBar.open(e.message, 'OK', { duration: 5000 }),
    });
  }
}
