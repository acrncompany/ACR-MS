import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  isDevMode,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ColDef } from 'ag-grid-community';
import { SessionService } from '../../../core/auth/session.service';
import { AppConfigService } from '../../../core/config/app-config.service';
import { toApiError } from '../../../core/http/api-error';
import { dateColumn, iconActionsColumn, statusColumn, textColumn } from '../../../shared/ag-grid';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { DataPage, SummaryItem } from '../../../shared/components/data-page/data-page';
import {
  DepartmentEntry,
  DepartmentInput,
  DesignationEntry,
  DesignationInput,
  PERSON_LABELS,
  PersonEntry,
  PersonKind,
} from '../domain/people-directory.models';
import { PeopleDirectoryRepository } from '../domain/people-directory.repository';
import { PagedList } from './paged-list';
import { DepartmentDialog, DesignationDialog } from './people-dialogs';

const NEW_BUTTON_STYLES = `
  .new-item {
    --mat-button-filled-container-shape: 0;
    --mat-button-filled-container-height: 44px;
    --mat-button-filled-horizontal-padding: 12px;
    --mat-button-filled-container-color: var(--brand-deep);
    --mat-button-filled-label-text-color: #ffffff;
    --mat-button-filled-label-text-size: 13px;
  }
`;

/** Employees or Articles (route data `kind`): the same list, columns and "new" page. */
@Component({
  selector: 'app-people-person-list-page',
  imports: [DataPage, MatButtonModule],
  template: `
    <app-data-page
      searchPlaceholder="Code, name, email"
      [summary]="summary()"
      [columns]="columns"
      [rows]="list.rows()"
      [serverSide]="true"
      [showEmptyMessage]="false"
      [clickableRows]="true"
      [total]="list.total()"
      [page]="list.page()"
      [pageSize]="list.pageSize()"
      [loading]="list.loading()"
      [errorMessage]="list.error()"
      (queryChange)="list.onQuery($event)"
      (rowClick)="open($any($event))"
    >
      <ng-container actions>
        @if (canCreate) {
          <button mat-flat-button type="button" class="new-item" (click)="add()">
            New {{ labels.singular }}
          </button>
        }
      </ng-container>
    </app-data-page>
  `,
  styles: NEW_BUTTON_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeoplePersonListPage {
  private readonly repo = inject(PeopleDirectoryRepository);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly locale = inject(AppConfigService).config.locale.locale;
  protected readonly kind: PersonKind = this.route.snapshot.data['kind'];
  protected readonly labels = PERSON_LABELS[this.kind];
  /** /hr/people (employees) or /hr/people/articles. */
  private readonly base = this.kind === 'employee' ? '/hr/people/employees' : '/hr/people/articles';
  private readonly session = inject(SessionService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly canCreate = this.session.can('hr.create');
  protected readonly list = new PagedList<PersonEntry>((q) => this.repo.people(this.kind, q));

  protected readonly columns: ColDef<PersonEntry>[] = [
    { ...textColumn<PersonEntry>('code', 'Code'), sortable: false },
    { ...textColumn<PersonEntry>('name', 'Name', 2), minWidth: 160, sortable: false },
    { ...textColumn<PersonEntry>('email', 'Email', 2), minWidth: 180, sortable: false },
    { ...textColumn<PersonEntry>('mobNo', 'Mob No.'), sortable: false },
    {
      ...textColumn<PersonEntry>('designationName', 'Designation', 2),
      minWidth: 150,
      sortable: false,
      valueFormatter: (p) => p.value || '—',
    },
    {
      ...textColumn<PersonEntry>('departmentName', 'Department', 2),
      minWidth: 150,
      sortable: false,
      valueFormatter: (p) => p.value || '—',
    },
    {
      ...textColumn<PersonEntry>('reportingManagerName', 'Reports to', 2),
      minWidth: 150,
      sortable: false,
      valueFormatter: (p) => p.value || '—',
    },
    { ...dateColumn<PersonEntry>('joinDate', 'Joined', this.locale), sortable: false },
    { ...statusColumn<PersonEntry>('status'), sortable: false },
    ...(this.session.can('hr.edit')
      ? [
          iconActionsColumn<PersonEntry>([
            { icon: 'edit', emoji: '✏️', title: 'Edit', run: (row) => this.edit(row) },
            // DEVELOPMENT ONLY: a real delete. The server refuses it in production, so the
            // button is not offered there either. Replace with a proper rule (deactivate) later.
            {
              icon: 'delete',
              danger: true,
              title: 'Delete',
              run: (row) => this.confirmDelete(row),
              visible: () => isDevMode(),
            },
          ]),
        ]
      : []),
  ];

  protected readonly summary = computed<SummaryItem[]>(() => [
    {
      label: this.labels.plural,
      value: String(this.list.total()),
      icon: this.kind === 'employee' ? 'groups' : 'school',
    },
  ]);

  private edit(row: PersonEntry): void {
    void this.router.navigate([this.base, row.id, 'edit']);
  }

  private confirmDelete(row: PersonEntry): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Delete ${row.name}?`,
          message: `Development only: ${row.code} is removed from the database for good, with its documents. The code is not reused.`,
          confirmLabel: 'Delete',
        },
      })
      .afterClosed()
      .subscribe((ok?: boolean) => ok && this.delete(row));
  }

  private delete(row: PersonEntry): void {
    this.repo.deletePerson(this.kind, row.id).subscribe({
      next: () => {
        this.snackBar.open('Deleted', 'OK', { duration: 2500 });
        this.list.reload();
      },
      error: (e: unknown) => this.snackBar.open(toApiError(e).message, 'OK', { duration: 6000 }),
    });
  }

  protected add(): void {
    void this.router.navigate([this.base, 'new']);
  }

  protected open(row: PersonEntry): void {
    void this.router.navigate([this.base, row.id]);
  }
}

@Component({
  selector: 'app-people-designations-page',
  imports: [DataPage, MatButtonModule],
  template: `
    <app-data-page
      searchPlaceholder="Code, name, department"
      [summary]="summary()"
      [columns]="columns"
      [rows]="list.rows()"
      [serverSide]="true"
      [showEmptyMessage]="false"
      [total]="list.total()"
      [page]="list.page()"
      [pageSize]="list.pageSize()"
      [loading]="list.loading()"
      [errorMessage]="list.error()"
      (queryChange)="list.onQuery($event)"
    >
      <ng-container actions>
        @if (canCreate) {
          <button mat-flat-button type="button" class="new-item" (click)="add()">
            New designation
          </button>
        }
      </ng-container>
    </app-data-page>
  `,
  styles: NEW_BUTTON_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeopleDesignationsPage {
  private readonly repo = inject(PeopleDirectoryRepository);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly canCreate = inject(SessionService).can('hr.create');
  protected readonly list = new PagedList<DesignationEntry>((q) => this.repo.designations(q));

  protected readonly columns: ColDef<DesignationEntry>[] = [
    { ...textColumn<DesignationEntry>('code', 'Code'), sortable: false },
    { ...textColumn<DesignationEntry>('name', 'Name', 2), minWidth: 180, sortable: false },
    { ...textColumn<DesignationEntry>('departmentName', 'Department', 2), sortable: false },
    {
      ...textColumn<DesignationEntry>('description', 'Description', 3),
      minWidth: 220,
      sortable: false,
    },
    { ...statusColumn<DesignationEntry>('status'), sortable: false },
  ];

  protected readonly summary = computed<SummaryItem[]>(() => [
    { label: 'Designations', value: String(this.list.total()), icon: 'badge' },
  ]);

  protected add(): void {
    this.dialog
      .open(DesignationDialog, { injector: this.injector })
      .afterClosed()
      .subscribe((input?: DesignationInput) => {
        if (!input) return;
        this.repo.createDesignation(input).subscribe({
          next: (created) => {
            this.snackBar.open(`Saved as ${created.code}`, 'OK', { duration: 3000 });
            this.list.reload();
          },
          // Duplicate name in the department (409): the server's message is readable.
          error: (e: unknown) =>
            this.snackBar.open(toApiError(e).message, 'OK', { duration: 8000 }),
        });
      });
  }
}

@Component({
  selector: 'app-people-departments-page',
  imports: [DataPage, MatButtonModule],
  template: `
    <app-data-page
      searchPlaceholder="Code, name"
      [summary]="summary()"
      [columns]="columns"
      [rows]="list.rows()"
      [serverSide]="true"
      [showEmptyMessage]="false"
      [total]="list.total()"
      [page]="list.page()"
      [pageSize]="list.pageSize()"
      [loading]="list.loading()"
      [errorMessage]="list.error()"
      (queryChange)="list.onQuery($event)"
    >
      <ng-container actions>
        @if (canCreate) {
          <button mat-flat-button type="button" class="new-item" (click)="add()">
            New department
          </button>
        }
      </ng-container>
    </app-data-page>
  `,
  styles: NEW_BUTTON_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeopleDepartmentsPage {
  private readonly repo = inject(PeopleDirectoryRepository);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly canCreate = inject(SessionService).can('hr.create');
  protected readonly list = new PagedList<DepartmentEntry>((q) => this.repo.departments(q));

  protected readonly columns: ColDef<DepartmentEntry>[] = [
    { ...textColumn<DepartmentEntry>('code', 'Code'), sortable: false },
    { ...textColumn<DepartmentEntry>('name', 'Name', 2), minWidth: 180, sortable: false },
    {
      ...textColumn<DepartmentEntry>('description', 'Description', 3),
      minWidth: 220,
      sortable: false,
    },
    { ...statusColumn<DepartmentEntry>('status'), sortable: false },
  ];

  protected readonly summary = computed<SummaryItem[]>(() => [
    { label: 'Departments', value: String(this.list.total()), icon: 'account_tree' },
  ]);

  protected add(): void {
    this.dialog
      .open(DepartmentDialog, { injector: this.injector })
      .afterClosed()
      .subscribe((input?: DepartmentInput) => {
        if (!input) return;
        this.repo.createDepartment(input).subscribe({
          next: (created) => {
            this.snackBar.open(`Saved as ${created.code}`, 'OK', { duration: 3000 });
            this.list.reload();
          },
          error: (e: unknown) =>
            this.snackBar.open(toApiError(e).message, 'OK', { duration: 8000 }),
        });
      });
  }
}
