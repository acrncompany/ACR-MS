import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SessionService } from '../../../core/auth/session.service';
import { KpiCard } from '../../../shared/components/kpi-card/kpi-card';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { NewWorksheetInput, WorksheetRepository } from '../domain/worksheet.repository';
import { NewSheetDialog, RecurringDialog } from './worksheet-dialogs';
import { SheetGrid } from './sheet-grid';
import { SheetRow, WorksheetContext } from './worksheet.context';
import { FilterSearch } from '../../../shared/components/filter-select/filter-search';
import { FilterSelect } from '../../../shared/components/filter-select/filter-select';

/** All work sheets the signed-in user may see, with filters. */
@Component({
  selector: 'app-worksheet-list-page',
  imports: [
    KpiCard,
    MatButtonModule,
    MatIconModule,
    PageHeader,
    SheetGrid,
    FilterSearch,
    FilterSelect,
  ],
  template: `
    <app-page-header title="Work sheets">
      @if (canCreate) {
        <button mat-flat-button type="button" (click)="create()">
          <mat-icon>add</mat-icon>
          New work sheet
        </button>
        <button mat-stroked-button type="button" (click)="generate()">
          <mat-icon>event_repeat</mat-icon>
          Generate this month's sheets
        </button>
      }
      @if (canEditClients) {
        <button mat-stroked-button type="button" (click)="recurring()">
          <mat-icon>autorenew</mat-icon>
          Recurring work
        </button>
      }
    </app-page-header>

    <section class="summary">
      <app-kpi-card
        [featured]="true"
        label="Open sheets"
        icon="assignment"
        [value]="'' + openCount()"
        [hint]="rows().length + ' visible in total'"
      />
      <app-kpi-card label="Overdue" icon="warning" tone="red" [value]="'' + overdue()" />
      <app-kpi-card label="In rework" icon="replay" tone="amber" [value]="'' + sentBack()" />
      <app-kpi-card label="Closed" icon="lock" tone="blue" [value]="'' + closed()" />
    </section>

    <div class="filter-bar">
      <app-filter-search placeholder="Search sheets" [(value)]="search" />
      <app-filter-select label="Stage" [options]="stageOptions()" [(value)]="stage" />
      <app-filter-select label="Work type" [options]="typeOptions()" [(value)]="type" />
      <app-filter-select label="Client" [options]="clientOptions()" [(value)]="client" />
      <app-filter-select label="Assignee" [options]="assigneeOptions()" [(value)]="assignee" />
      <app-filter-select label="Period" [options]="periodOptions()" [(value)]="period" />
      <button
        type="button"
        class="filter-pill"
        [attr.aria-pressed]="onlyOverdue()"
        (click)="onlyOverdue.set(!onlyOverdue())"
      >
        <mat-icon>warning</mat-icon> Overdue
      </button>
      @if (filtering()) {
        <button mat-button type="button" (click)="clear()">Clear</button>
      }
    </div>
    <p class="count">{{ filtered().length }} of {{ rows().length }} sheets</p>
    <app-sheet-grid
      [paged]="true"
      [rows]="filtered()"
      [quickFilter]="search()"
      [today]="ctx.today"
      [locale]="ctx.locale.locale"
      (open)="open($event)"
    />
  `,
  styles: `
    :host {
      display: flex;
      flex: 1 1 0;
      flex-direction: column;
      min-height: 0;
    }
    app-page-header {
      margin-bottom: 0.6rem;
    }
    .summary {
      display: grid;
      flex: none;
      grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
      gap: 0.75rem;
      margin-bottom: 0.6rem;
    }
    .count {
      margin: 0.4rem 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-large);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorksheetListPage {
  protected readonly ctx = inject(WorksheetContext);
  private readonly repo = inject(WorksheetRepository);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly snackBar = inject(MatSnackBar);
  private readonly session = inject(SessionService);

  protected readonly canCreate = this.session.can('worksheet.create');
  protected readonly canEditClients = this.session.can('clients.edit');

  protected readonly rows = this.ctx.rows;
  protected readonly search = signal('');
  protected readonly stage = signal('');
  protected readonly type = signal('');
  protected readonly client = signal('');
  protected readonly assignee = signal('');
  protected readonly period = signal('');
  protected readonly onlyOverdue = signal(false);

  protected readonly stageOptions = computed(() =>
    this.repo.workflow().stages.map((s) => ({ value: s.key, label: s.label })),
  );
  protected readonly typeOptions = computed(() =>
    this.repo.workTypes().map((t) => ({ value: t.key, label: t.label })),
  );
  protected readonly clientOptions = computed(() =>
    this.distinct(this.rows().map((r) => [r.sheet.clientId, r.clientName] as const)),
  );
  protected readonly assigneeOptions = computed(() => {
    const names = new Set(this.rows().flatMap((r) => r.assignees));
    return [...names].sort().map((n) => ({ value: n, label: n }));
  });
  protected readonly periodOptions = computed(() => {
    const periods = new Set(this.rows().map((r) => r.period));
    return [...periods].sort().map((p) => ({ value: p, label: p }));
  });

  protected readonly filtering = computed(
    () =>
      !!(
        this.stage() ||
        this.type() ||
        this.client() ||
        this.assignee() ||
        this.period() ||
        this.onlyOverdue() ||
        this.search()
      ),
  );

  protected readonly filtered = computed<SheetRow[]>(() =>
    this.rows().filter(
      (r) =>
        (!this.stage() || r.stageKey === this.stage()) &&
        (!this.type() || r.sheet.workTypeKey === this.type()) &&
        (!this.client() || r.sheet.clientId === this.client()) &&
        (!this.assignee() || r.assignees.includes(this.assignee())) &&
        (!this.period() || r.period === this.period()) &&
        (!this.onlyOverdue() || r.overdue),
    ),
  );

  protected readonly openCount = computed(() => this.rows().filter((r) => !r.closed).length);
  protected readonly overdue = computed(() => this.rows().filter((r) => r.overdue).length);
  protected readonly sentBack = computed(() => this.rows().filter((r) => r.sentBack).length);
  protected readonly closed = computed(() => this.rows().filter((r) => r.closed).length);

  private distinct(pairs: (readonly [string, string])[]): { value: string; label: string }[] {
    return [...new Map(pairs).entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  protected clear(): void {
    this.search.set('');
    this.stage.set('');
    this.type.set('');
    this.client.set('');
    this.assignee.set('');
    this.period.set('');
    this.onlyOverdue.set(false);
  }

  protected open(id: string): void {
    void this.router.navigate(['/worksheets', id]);
  }

  protected create(): void {
    this.dialog
      .open(NewSheetDialog, {
        data: { clients: this.ctx.clients(), workTypes: this.repo.workTypes() },
      })
      .afterClosed()
      .subscribe((input?: NewWorksheetInput) => {
        if (!input) return;
        this.repo.create(input).subscribe({
          next: (sheet) => this.open(sheet.id),
          error: (e: Error) => this.snackBar.open(e.message, 'OK', { duration: 5000 }),
        });
      });
  }

  protected generate(): void {
    this.repo.generateRecurring().subscribe({
      next: ({ created, skipped }) =>
        this.snackBar.open(
          created
            ? `Created ${created} sheet${created === 1 ? '' : 's'} for this period` +
                (skipped ? ` (${skipped} already existed)` : '')
            : `Nothing new to create (${skipped} already existed)`,
          'OK',
          { duration: 6000 },
        ),
      error: (e: Error) => this.snackBar.open(e.message, 'OK', { duration: 5000 }),
    });
  }

  protected recurring(): void {
    this.dialog.open(RecurringDialog, {
      // The dialog reads the client repository, which this route provides.
      injector: this.injector,
      data: {
        clients: this.ctx.clients(),
        workTypes: this.repo.workTypes(),
        onChanged: () => this.ctx.reloadClients(),
      },
    });
  }
}
