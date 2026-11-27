import { ChangeDetectionStrategy, Component, computed, inject, Injector } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ColDef } from 'ag-grid-community';
import { SessionService } from '../../../core/auth/session.service';
import { AppConfigService } from '../../../core/config/app-config.service';
import { toApiError } from '../../../core/http/api-error';
import { dateColumn, statusColumn, textColumn } from '../../../shared/ag-grid';
import { DataPage, SummaryItem } from '../../../shared/components/data-page/data-page';
import {
  DepartmentEntry,
  DepartmentInput,
  DesignationEntry,
  DesignationInput,
  EmployeeEntry,
  EmployeeInput,
} from '../domain/people-directory.models';
import { PeopleDirectoryRepository } from '../domain/people-directory.repository';
import { PagedList } from './paged-list';
import { DepartmentDialog, DesignationDialog, EmployeeDialog } from './people-dialogs';

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

@Component({
  selector: 'app-people-employees-page',
  imports: [DataPage, MatButtonModule],
  template: `
    <app-data-page
      searchPlaceholder="Code, name, email"
      [summary]="summary()"
      [columns]="columns"
      [rows]="list.rows()"
      [serverSide]="true"
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
            New employee
          </button>
        }
      </ng-container>
    </app-data-page>
  `,
  styles: NEW_BUTTON_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeopleEmployeesPage {
  private readonly repo = inject(PeopleDirectoryRepository);
  private readonly dialog = inject(MatDialog);
  // Dialogs get this injector so they can see the route-scoped repository.
  private readonly injector = inject(Injector);
  private readonly snackBar = inject(MatSnackBar);
  private readonly locale = inject(AppConfigService).config.locale.locale;
  protected readonly canCreate = inject(SessionService).can('hr.create');
  protected readonly list = new PagedList<EmployeeEntry>((q) => this.repo.employees(q));

  protected readonly columns: ColDef<EmployeeEntry>[] = [
    { ...textColumn<EmployeeEntry>('code', 'Code'), sortable: false },
    { ...textColumn<EmployeeEntry>('name', 'Name', 2), minWidth: 160, sortable: false },
    { ...textColumn<EmployeeEntry>('email', 'Email', 2), minWidth: 180, sortable: false },
    { ...textColumn<EmployeeEntry>('phone', 'Phone'), sortable: false },
    {
      ...textColumn<EmployeeEntry>('designationName', 'Designation', 2),
      minWidth: 150,
      sortable: false,
      valueFormatter: (p) => p.value || '—',
    },
    {
      ...textColumn<EmployeeEntry>('departmentName', 'Department', 2),
      minWidth: 150,
      sortable: false,
      valueFormatter: (p) => p.value || '—',
    },
    { ...dateColumn<EmployeeEntry>('joinDate', 'Joined', this.locale), sortable: false },
    { ...statusColumn<EmployeeEntry>('status'), sortable: false },
  ];

  protected readonly summary = computed<SummaryItem[]>(() => [
    { label: 'Employees', value: String(this.list.total()), icon: 'groups' },
  ]);

  protected add(): void {
    this.dialog
      .open(EmployeeDialog, { injector: this.injector })
      .afterClosed()
      .subscribe((input?: EmployeeInput) => {
        if (!input) return;
        this.repo.createEmployee(input).subscribe({
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
