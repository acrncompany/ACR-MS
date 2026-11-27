import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ColDef } from 'ag-grid-community';
import { SessionService } from '../../../core/auth/session.service';
import { toApiError } from '../../../core/http/api-error';
import { iconActionsColumn, textColumn } from '../../../shared/ag-grid';
import { DataPage, SummaryItem } from '../../../shared/components/data-page/data-page';
import { WorkEntry, WorkInput } from '../domain/work.models';
import { WorkRepository } from '../domain/work.repository';
import { WorkDialog } from './work-dialog';

/**
 * The works master list (same layout as the client list). Search (name, code) and
 * paging happen on the server. New types are created in a dialog; the server issues the code.
 */
@Component({
  selector: 'app-works-page',
  imports: [DataPage, MatButtonModule],
  template: `
    <app-data-page
      searchPlaceholder="Code, name"
      [summary]="summary()"
      [columns]="columns"
      [rows]="rows()"
      [serverSide]="true"
      [total]="total()"
      [page]="page()"
      [pageSize]="pageSize()"
      [loading]="loading()"
      [errorMessage]="error()"
      (queryChange)="onQuery($event)"
    >
      <ng-container actions>
        @if (canCreate) {
          <button mat-flat-button type="button" class="new-item" (click)="add()">
            <span class="label">New work</span>
          </button>
        }
      </ng-container>
    </app-data-page>
  `,
  styles: `
    .new-item {
      --mat-button-filled-container-shape: 0;
      --mat-button-filled-container-height: 44px;
      --mat-button-filled-horizontal-padding: 12px;
      --mat-button-filled-container-color: var(--brand-deep);
      --mat-button-filled-label-text-color: #ffffff;
      --mat-button-filled-label-text-size: 13px;
    }
    .label {
      display: inline-block;
      line-height: 1.2;
      text-align: left;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorksPage {
  private readonly repo = inject(WorkRepository);
  private readonly dialog = inject(MatDialog);
  // Dialogs get this injector so they can see the route-scoped repository.
  private readonly injector = inject(Injector);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly canCreate = inject(SessionService).can('clients.create');
  // The backend uses the same permission for create and rename.
  protected readonly canEdit = this.canCreate;

  private readonly items = signal<WorkEntry[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private search = '';

  constructor() {
    this.load();
  }

  protected readonly rows = computed(() => this.items());

  protected readonly summary = computed<SummaryItem[]>(() => [
    { label: 'Works', value: String(this.total()), icon: 'account_tree' },
  ]);

  protected onQuery(query: { search: string; page: number; pageSize: number }): void {
    this.search = query.search;
    this.page.set(query.page);
    this.pageSize.set(query.pageSize);
    this.load();
  }

  protected add(): void {
    this.dialog
      .open(WorkDialog, { injector: this.injector })
      .afterClosed()
      .subscribe((input?: WorkInput) => input && this.create(input));
  }

  private edit(row: WorkEntry): void {
    this.dialog
      .open(WorkDialog, { injector: this.injector, data: row })
      .afterClosed()
      .subscribe((input?: WorkInput) => input && this.update(row, input));
  }

  private update(row: WorkEntry, input: WorkInput): void {
    this.repo.update(row.id, input).subscribe({
      next: (updated) => {
        this.snackBar.open(`${updated.code} updated`, 'OK', { duration: 3000 });
        this.load();
      },
      error: (e: unknown) => this.snackBar.open(toApiError(e).message, 'OK', { duration: 8000 }),
    });
  }

  private create(input: WorkInput): void {
    this.repo.create(input).subscribe({
      next: (created) => {
        this.snackBar.open(`Saved as ${created.code}`, 'OK', { duration: 3000 });
        this.load();
      },
      // Duplicate name (409): the server's message is readable.
      error: (e: unknown) => this.snackBar.open(toApiError(e).message, 'OK', { duration: 8000 }),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.repo.list({ q: this.search, page: this.page(), pageSize: this.pageSize() }).subscribe({
      next: (result) => {
        this.items.set(result.items);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.items.set([]);
        this.total.set(0);
        this.loading.set(false);
        this.error.set(toApiError(e).message);
      },
    });
  }

  protected readonly columns: ColDef<WorkEntry>[] = [
    {
      ...textColumn<WorkEntry>('code', 'Code'),
      minWidth: 110,
      flex: 1,
      sortable: false,
    },
    {
      ...textColumn<WorkEntry>('name', 'Name', 3),
      minWidth: 220,
      sortable: false,
    },
    ...(this.canEdit
      ? [
          iconActionsColumn<WorkEntry>([
            { icon: 'edit', title: 'Edit', run: (row) => this.edit(row) },
          ]),
        ]
      : []),
  ];
}
