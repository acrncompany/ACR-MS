import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, switchMap } from 'rxjs';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { addDays, formatDate } from '../../../shared/utils/date';
import { WorkSheet } from '../domain/worksheet.models';
import { WorksheetRepository } from '../domain/worksheet.repository';
import {
  availableActions,
  canReassign,
  canRetarget,
  editableSections,
  stageDef,
} from '../domain/workflow-engine';
import { ActionDef, SectionKey } from '../domain/workflow.models';
import { TimelinePanel } from './timeline-panel';
import {
  ActionDialog,
  ReassignDialog,
  ReassignSlotOption,
  RetargetDialog,
} from './worksheet-dialogs';
import { WorksheetForm } from './worksheet-form';
import { WorksheetContext } from './worksheet.context';

type StepState = 'done' | 'current' | 'upcoming';

@Component({
  selector: 'app-worksheet-detail-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    PageHeader,
    RouterLink,
    TimelinePanel,
    WorksheetForm,
  ],
  templateUrl: './worksheet-detail-page.html',
  styleUrl: './worksheet-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorksheetDetailPage {
  /** Route parameter (`/worksheets/:id`). */
  readonly id = input.required<string>();

  protected readonly ctx = inject(WorksheetContext);
  protected readonly repo = inject(WorksheetRepository);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly sheet = computed(() => this.repo.sheets().find((s) => s.id === this.id()));
  protected readonly config = this.repo.workflow;
  protected readonly stage = computed(() => {
    const sheet = this.sheet();
    return sheet ? stageDef(this.config(), sheet.stage) : undefined;
  });
  protected readonly row = computed(() => this.ctx.rows().find((r) => r.id === this.id()));

  /** Working copy edited by the form. Reset when the stage changes or after our own save. */
  protected readonly draft = signal<WorkSheet | null>(null);
  private resync = false;
  protected readonly busy = signal(false);

  protected readonly editable = computed(() => {
    const sheet = this.sheet();
    const actor = this.repo.actor();
    return sheet && actor ? editableSections(sheet, actor, this.config()) : new Set<SectionKey>();
  });
  protected readonly actions = computed<ActionDef[]>(() => {
    const sheet = this.sheet();
    const actor = this.repo.actor();
    return sheet && actor ? availableActions(sheet, actor, this.config()) : [];
  });
  protected readonly mayReassign = computed(() => {
    const sheet = this.sheet();
    const actor = this.repo.actor();
    return !!sheet && !!actor && canReassign(sheet, actor, this.config());
  });
  protected readonly mayRetarget = computed(() => {
    const sheet = this.sheet();
    const actor = this.repo.actor();
    return !!sheet && !!actor && canRetarget(sheet, actor, this.config());
  });

  protected readonly steps = computed(() => {
    const sheet = this.sheet();
    const config = this.config();
    const current = sheet ? stageDef(config, sheet.stage) : undefined;
    return config.stages.map((s) => ({
      key: s.key,
      label: s.label,
      order: s.order,
      state: (!current
        ? 'upcoming'
        : s.order < current.order || (s.terminal && current.terminal)
          ? 'done'
          : s.key === current.key
            ? 'current'
            : 'upcoming') as StepState,
    }));
  });

  /** Who has to act next, in words. */
  protected readonly waitingFor = computed(() => {
    const sheet = this.sheet();
    const stage = this.stage();
    if (!sheet || !stage || stage.terminal) return '';
    const person =
      stage.actor === 'any'
        ? ''
        : this.repo.nameOf(
            sheet[
              stage.actor === 'ops'
                ? 'assignedOpsId'
                : stage.actor === 'tl'
                  ? 'assignedTlId'
                  : 'assignedTmId'
            ],
          );
    if (stage.actor === 'any') return 'Open to anyone allowed to act at this stage';
    return person && person !== '—' ? `Waiting for ${person}` : 'Waiting for the next person';
  });

  protected readonly meta = computed(() => {
    const sheet = this.sheet();
    if (!sheet) return '';
    return [
      this.waitingFor(),
      sheet.targetDate ? `Target ${this.date(sheet.targetDate)}` : '',
      sheet.reworkCount
        ? `Sent back ${sheet.reworkCount} time${sheet.reworkCount === 1 ? '' : 's'}`
        : '',
    ]
      .filter(Boolean)
      .join(' · ');
  });

  protected readonly names = (id: string | null): string => this.repo.nameOf(id);
  protected readonly stageName = (key: string): string => this.ctx.stageLabel(key);

  constructor() {
    effect(() => {
      const sheet = this.sheet();
      if (!sheet) {
        this.draft.set(null);
        return;
      }
      const current = this.draft();
      if (!current || current.id !== sheet.id || current.stage !== sheet.stage || this.resync) {
        this.resync = false;
        this.draft.set(structuredClone(sheet));
      }
    });
  }

  protected date(iso: string): string {
    return formatDate(iso, this.ctx.locale.locale);
  }

  protected save(): void {
    const draft = this.draft();
    if (!draft) return;
    this.busy.set(true);
    this.repo.saveSections(draft).subscribe({
      next: (saved) => {
        this.busy.set(false);
        const changed = saved.history.length !== (this.sheet()?.history.length ?? 0);
        this.snackBar.open(changed ? 'Saved' : 'No changes to save', 'OK', { duration: 3000 });
      },
      error: (e: Error) => this.fail(e),
    });
  }

  protected run(action: ActionDef): void {
    const sheet = this.sheet();
    if (!sheet) return;
    const slotLabel = this.config().slots.find((s) => s.slot === action.slot)?.label ?? '';
    this.dialog
      .open(ActionDialog, {
        data: {
          workNo: sheet.workNo,
          title: `${this.ctx.clientName(sheet.clientId)} · ${this.ctx.typeLabel(sheet.workTypeKey)}`,
          action,
          slotLabel,
          assignees: action.slot ? this.repo.assignees(action.slot) : [],
          defaultTarget: sheet.targetDate || addDays(this.ctx.today, 7),
        },
      })
      .afterClosed()
      .subscribe((payload) => {
        if (!payload) return;
        const draft = this.draft();
        // Typed-in sections are saved first so the server validates what is on screen.
        const perform = (): Observable<WorkSheet> =>
          this.repo.perform(sheet.id, action.key, payload);
        const call =
          draft && this.editable().size
            ? this.repo.saveSections(draft).pipe(switchMap(perform))
            : perform();
        this.busy.set(true);
        this.resync = true;
        call.subscribe({
          next: () => {
            this.busy.set(false);
            this.snackBar.open(`${action.label}: done`, 'OK', { duration: 3500 });
          },
          error: (e: Error) => this.fail(e),
        });
      });
  }

  protected reassign(): void {
    const sheet = this.sheet();
    if (!sheet) return;
    const slots: ReassignSlotOption[] = this.config()
      .slots.map((def) => {
        const currentId =
          sheet[
            def.slot === 'ops'
              ? 'assignedOpsId'
              : def.slot === 'tl'
                ? 'assignedTlId'
                : 'assignedTmId'
          ];
        return {
          slot: def.slot,
          label: def.label,
          current: this.repo.nameOf(currentId),
          currentId,
          candidates: this.repo.assignees(def.slot),
        };
      })
      .filter((s) => s.currentId && s.candidates.some((c) => c.id !== s.currentId));
    if (!slots.length) {
      this.snackBar.open('Nobody else is available below you to reassign to.', 'OK', {
        duration: 5000,
      });
      return;
    }
    this.dialog
      .open(ReassignDialog, { data: { workNo: sheet.workNo, slots } })
      .afterClosed()
      .subscribe((payload) => {
        if (!payload) return;
        this.repo.reassign(sheet.id, payload).subscribe({
          next: () => this.snackBar.open('Reassigned', 'OK', { duration: 3000 }),
          error: (e: Error) => this.fail(e),
        });
      });
  }

  protected retarget(): void {
    const sheet = this.sheet();
    if (!sheet) return;
    this.dialog
      .open(RetargetDialog, {
        data: { workNo: sheet.workNo, current: this.date(sheet.targetDate) },
      })
      .afterClosed()
      .subscribe((payload) => {
        if (!payload) return;
        this.repo.retarget(sheet.id, payload).subscribe({
          next: () => this.snackBar.open('Target date changed', 'OK', { duration: 3000 }),
          error: (e: Error) => this.fail(e),
        });
      });
  }

  protected onCredentialRevealed(fieldLabel: string): void {
    const sheet = this.sheet();
    if (sheet) this.repo.logCredentialReveal(sheet.id, fieldLabel).subscribe();
  }

  private fail(error: Error): void {
    this.busy.set(false);
    this.resync = false;
    this.snackBar.open(error.message, 'OK', { duration: 7000 });
  }
}
