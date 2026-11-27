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
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ColDef } from 'ag-grid-community';
import { Observable } from 'rxjs';
import { SessionService } from '../../../core/auth/session.service';
import { AppConfigService } from '../../../core/config/app-config.service';
import { toApiError } from '../../../core/http/api-error';
import { actionsColumn, statusColumn, textColumn } from '../../../shared/ag-grid';
import { DataPage, SummaryItem } from '../../../shared/components/data-page/data-page';
import { FilterSelect } from '../../../shared/components/filter-select/filter-select';
import { AssignableStaff, Position, StaffMember } from '../domain/admin.models';
import { OrganizationRepository } from '../domain/organization.repository';
import { StaffRepository } from '../domain/staff.repository';
import {
  ConfirmDialog,
  TemporaryPasswordDialog,
  UserDialog,
  UserDialogData,
  UserDialogResult,
} from './admin-dialogs';
import { StaffProfileDialog } from './staff-profile-dialog';
import { buildStaffView } from './staff-view';

interface UserRow {
  user: StaffMember;
  employeeCode: string;
  name: string;
  designation: string;
  email: string;
  position: string;
  department: string;
  manager: string;
  status: 'Active' | 'Inactive';
}

/**
 * Users. The list, the search (name, code, email) and the paging all happen on the server, which
 * also decides who may see whom and what each row's actions are.
 */
@Component({
  selector: 'app-users-page',
  imports: [DataPage, FilterSelect, MatButtonModule, MatIconModule],
  template: `
    <app-data-page
      title="Users"
      searchPlaceholder="Name, code, email"
      [summary]="summary()"
      [columns]="columns()"
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
          <button mat-flat-button type="button" (click)="add()">
            <mat-icon>person_add</mat-icon>
            Add user
          </button>
        }
      </ng-container>
      <ng-container filters>
        <app-filter-select
          label="Status"
          [options]="statusOptions"
          [(value)]="status"
          (valueChange)="onStatus()"
        />
      </ng-container>
    </app-data-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPage {
  private readonly staff = inject(StaffRepository);
  private readonly organization = inject(OrganizationRepository);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly snackBar = inject(MatSnackBar);
  private readonly session = inject(SessionService);
  private readonly locale = inject(AppConfigService).config.locale.locale;

  protected readonly canCreate = this.session.can('users.create');
  private readonly canEdit = this.session.can('users.edit');
  private readonly canDeactivate = this.session.can('users.deactivate');

  protected readonly status = signal('');
  protected readonly statusOptions = [
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'Inactive' },
  ];

  private readonly items = signal<StaffMember[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private search = '';
  private positions: Position[] = [];

  constructor() {
    this.organization
      .positions()
      .subscribe({ next: (p) => (this.positions = p), error: () => undefined });
    this.load();
  }

  protected readonly rows = computed<UserRow[]>(() =>
    this.items().map((user) => ({
      user,
      employeeCode: user.employeeCode,
      name: user.name,
      designation: user.designationCode ?? '',
      email: user.email,
      position: user.positionName ?? '—',
      department: user.departmentName ?? '—',
      manager: user.managerName ?? '—',
      status: user.active ? 'Active' : 'Inactive',
    })),
  );

  protected readonly summary = computed<SummaryItem[]>(() => [
    { label: 'Users', value: String(this.total()), icon: 'manage_accounts' },
  ]);

  protected readonly columns = computed<ColDef<UserRow>[]>(() => [
    { ...textColumn<UserRow>('employeeCode', 'Code'), minWidth: 110, flex: 0.8, sortable: false },
    { ...textColumn<UserRow>('name', 'Name', 2), minWidth: 150, sortable: false },
    {
      ...textColumn<UserRow>('designation', 'Desig.'),
      minWidth: 90,
      flex: 0.5,
      sortable: false,
      valueFormatter: (p) => p.value || '—',
    },
    { ...textColumn<UserRow>('email', 'Email', 2), minWidth: 190, sortable: false },
    { ...textColumn<UserRow>('position', 'Position', 2), minWidth: 190, sortable: false },
    { ...textColumn<UserRow>('department', 'Department'), sortable: false },
    { ...textColumn<UserRow>('manager', 'Reports to'), sortable: false },
    { ...statusColumn<UserRow>('status'), sortable: false },
    {
      ...actionsColumn<UserRow>([
        { label: () => 'View', run: (row) => this.view(row.user) },
        {
          label: () => 'Edit',
          run: (row) => this.edit(row.user),
          visible: (row) => this.canEdit && row.user.canManage === true,
        },
        {
          label: (row) => (row.user.active ? 'Deactivate' : 'Reactivate'),
          visible: (row) => this.canDeactivate && row.user.canManage === true,
          run: (row) => this.toggleActive(row.user),
        },
        {
          // The SERVER decides whether the delete is allowed: a person with history answers 409
          // with a message, and must be deactivated instead.
          label: () => 'Delete',
          visible: (row) => this.canDeactivate && row.user.canManage === true,
          run: (row) => this.remove(row.user),
        },
      ]),
      minWidth: 300,
      flex: 2,
      sortable: false,
    },
  ]);

  protected onQuery(query: { search: string; page: number; pageSize: number }): void {
    this.search = query.search;
    this.page.set(query.page);
    this.pageSize.set(query.pageSize);
    this.load();
  }

  protected onStatus(): void {
    this.page.set(1);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    const active = this.status() === '' ? null : this.status() === 'Active';
    this.staff
      .list({ q: this.search, page: this.page(), pageSize: this.pageSize(), active })
      .subscribe({
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

  protected add(): void {
    this.staff.creatablePositionIds().subscribe({
      next: (ids) => {
        const creatable = this.positions.filter((p) => ids.includes(p.id));
        if (!creatable.length) {
          this.snackBar.open('You cannot create users in any position.', 'OK', { duration: 5000 });
          return;
        }
        this.staff.assignable().subscribe({
          next: (managers) =>
            this.open(
              { title: 'Add user', positions: creatable, managers, canMove: this.canMove() },
              (r) => this.create(r),
            ),
          error: (e: unknown) => this.fail(e),
        });
      },
      error: (e: unknown) => this.fail(e),
    });
  }

  private edit(user: StaffMember): void {
    this.staff.assignable().subscribe({
      next: (managers) => {
        const withCurrent = this.withCurrentManager(managers, user);
        this.open(
          {
            title: 'Edit user',
            positions: this.positions,
            managers: withCurrent,
            user,
            canMove: this.canMove(),
          },
          (r) => this.update(user.id, r),
        );
      },
      error: (e: unknown) => this.fail(e),
    });
  }

  /** The current manager stays listed even if they were deactivated since. */
  private withCurrentManager(managers: AssignableStaff[], user: StaffMember): AssignableStaff[] {
    if (!user.managerId || managers.some((m) => m.id === user.managerId)) return managers;
    return [
      ...managers,
      {
        id: user.managerId,
        name: `${user.managerName ?? 'Former manager'} (inactive)`,
        employeeCode: user.managerCode ?? '',
        positionId: null,
        positionName: null,
      },
    ];
  }

  /** Board/GM with the move permission may change position and manager. */
  private canMove(): boolean {
    return !!this.session.user()?.seesAll && this.session.can('position.move');
  }

  private view(user: StaffMember): void {
    this.dialog.open(StaffProfileDialog, { data: buildStaffView(user, this.locale) });
  }

  private open(data: UserDialogData, save: (result: UserDialogResult) => void): void {
    this.dialog
      .open(UserDialog, { data, injector: this.injector })
      .afterClosed()
      .subscribe((result?: UserDialogResult) => result && save(result));
  }

  private create(result: UserDialogResult): void {
    this.staff
      .create({
        ...result.input,
        ...(result.generateTemporaryPassword
          ? { generateTemporaryPassword: true }
          : { password: result.password }),
      })
      .subscribe({
        next: ({ user, temporaryPassword }) => {
          this.snackBar.open(`${user.employeeCode} created`, 'OK', { duration: 3000 });
          this.load();
          if (temporaryPassword) {
            this.dialog.open(TemporaryPasswordDialog, {
              disableClose: true,
              data: {
                name: user.name,
                employeeCode: user.employeeCode,
                email: user.email,
                password: temporaryPassword,
              },
            });
          }
        },
        error: (e: unknown) => this.fail(e),
      });
  }

  private update(id: string, result: UserDialogResult): void {
    const { positionId, managerId, ...rest } = result.input;
    this.apply(
      this.staff.update(id, this.canMove() ? { ...rest, positionId, managerId } : rest),
      'Saved',
    );
  }

  private toggleActive(user: StaffMember): void {
    const deactivating = user.active;
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `${deactivating ? 'Deactivate' : 'Reactivate'} ${user.name}?`,
          message: deactivating
            ? 'They are signed out at once and no longer appear in assignment lists. Their past work and history stay.'
            : 'They can sign in again and appear in assignment lists.',
          confirmLabel: deactivating ? 'Deactivate' : 'Reactivate',
        },
      })
      .afterClosed()
      .subscribe(
        (ok?: boolean) => ok && this.apply(this.staff.setActive(user.id, !deactivating), 'Saved'),
      );
  }

  private remove(user: StaffMember): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Delete ${user.name}?`,
          message: `Only for a record created by mistake. If ${user.name} has any history the server refuses and you can deactivate them instead. The code ${user.employeeCode} is never reused.`,
          confirmLabel: 'Delete',
        },
      })
      .afterClosed()
      .subscribe((ok?: boolean) => ok && this.apply(this.staff.delete(user.id), 'Deleted'));
  }

  private apply(change: Observable<unknown>, done: string): void {
    change.subscribe({
      next: () => {
        this.snackBar.open(done, 'OK', { duration: 2500 });
        this.load();
      },
      error: (e: unknown) => this.fail(e),
    });
  }

  private fail(error: unknown): void {
    // 409 HAS_HISTORY carries a readable message ("... Deactivate them instead.").
    this.snackBar.open(toApiError(error).message, 'OK', { duration: 8000 });
  }
}
