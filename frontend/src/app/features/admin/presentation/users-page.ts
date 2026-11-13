import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ColDef } from 'ag-grid-community';
import { Observable } from 'rxjs';
import { SessionService } from '../../../core/auth/session.service';
import { actionsColumn, statusColumn, textColumn } from '../../../shared/ag-grid';
import { DataPage, SummaryItem } from '../../../shared/components/data-page/data-page';
import { DirectoryUser } from '../domain/admin.models';
import { DirectoryRepository } from '../domain/directory.repository';
import { UserDialog, UserDialogData } from './admin-dialogs';
import { ResetDemoButton } from './reset-demo-button';

interface UserRow {
  user: DirectoryUser;
  name: string;
  email: string;
  position: string;
  department: string;
  role: string;
  manager: string;
  status: 'Active' | 'Inactive';
}

@Component({
  selector: 'app-users-page',
  imports: [DataPage, MatButtonModule, MatIconModule, ResetDemoButton],
  template: `
    <app-data-page
      title="Users"
      [summary]="summary()"
      [columns]="columns()"
      [rows]="rows()"
    >
      <ng-container actions>
        @if (canCreate()) {
          <button mat-flat-button type="button" (click)="add()">
            <mat-icon>person_add</mat-icon>
            Add user
          </button>
        }
        <app-reset-demo-button />
      </ng-container>
    </app-data-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPage {
  private readonly repo = inject(DirectoryRepository);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly session = inject(SessionService);

  protected readonly canCreate = computed(
    () => this.session.can('users.create') && this.repo.creatablePositions().length > 0,
  );
  private readonly canEdit = this.session.can('users.edit');

  protected readonly rows = computed<UserRow[]>(() => {
    const positions = new Map(this.repo.positions().map((p) => [p.id, p]));
    const roles = new Map(this.repo.roles().map((r) => [r.id, r.name]));
    const depts = new Map(this.repo.departments().map((d) => [d.id, d.name]));
    const users = this.repo.visibleUsers();
    const names = new Map(this.repo.users().map((u) => [u.id, u.name]));
    return users.map((user) => {
      const position = positions.get(user.positionId);
      return {
        user,
        name: user.name,
        email: user.email,
        position: position?.title ?? '—',
        department: depts.get(position?.departmentId ?? '') ?? '—',
        role: roles.get(position?.roleId ?? '') ?? '—',
        manager: user.managerId ? (names.get(user.managerId) ?? '—') : '—',
        status: user.active ? 'Active' : 'Inactive',
      };
    });
  });

  protected readonly columns = computed<ColDef<UserRow>[]>(() => {
    const base: ColDef<UserRow>[] = [
      { ...textColumn<UserRow>('name', 'Name', 2), minWidth: 150 },
      { ...textColumn<UserRow>('email', 'Email', 2), minWidth: 190 },
      { ...textColumn<UserRow>('position', 'Position', 2), minWidth: 190 },
      textColumn<UserRow>('department', 'Department'),
      { ...textColumn<UserRow>('role', 'Role', 2), minWidth: 170 },
      textColumn<UserRow>('manager', 'Reports to'),
      statusColumn<UserRow>('status'),
    ];
    if (this.canEdit) {
      base.push(
        actionsColumn<UserRow>([
          {
            label: () => 'Edit',
            run: (row) => this.edit(row.user),
            visible: (row) => this.repo.canManageUser(row.user.id),
          },
          {
            label: (row) => (row.user.active ? 'Deactivate' : 'Activate'),
            visible: (row) => this.repo.canManageUser(row.user.id),
            run: (row) =>
              this.apply(this.repo.updateUser(row.user.id, { active: !row.user.active })),
          },
        ]),
      );
    }
    return base;
  });

  protected readonly summary = computed<SummaryItem[]>(() => {
    const users = this.repo.visibleUsers();
    return [
      { label: 'Users', value: String(users.length), icon: 'manage_accounts' },
      {
        label: 'Active',
        value: String(users.filter((u) => u.active).length),
        icon: 'check_circle',
        tone: 'blue',
      },
      {
        label: 'Inactive',
        value: String(users.filter((u) => !u.active).length),
        icon: 'person_off',
        tone: 'red',
      },
    ];
  });

  protected add(): void {
    this.open({ title: 'Add user' }, (value) => this.repo.addUser(value));
  }

  private edit(user: DirectoryUser): void {
    this.open({ title: 'Edit user', user, excludedManagers: this.reports(user.id) }, (value) =>
      this.repo.updateUser(user.id, value),
    );
  }

  private open(
    extra: Pick<UserDialogData, 'title' | 'user' | 'excludedManagers'>,
    save: (value: Omit<DirectoryUser, 'id'>) => Observable<void>,
  ): void {
    const data: UserDialogData = {
      ...extra,
      // Adding: only the positions directly below the signed-in user. Editing: position is fixed.
      positions: extra.user ? this.repo.positions() : this.repo.creatablePositions(),
      users: this.repo.users(),
      restricted: !this.session.user()?.seesAll,
    };
    this.dialog
      .open(UserDialog, { data })
      .afterClosed()
      .subscribe((value?: Omit<DirectoryUser, 'id'>) => value && this.apply(save(value)));
  }

  private apply(change: Observable<void>): void {
    change.subscribe({
      next: () => this.snackBar.open('Saved', 'OK', { duration: 2000 }),
      error: (e: Error) => this.snackBar.open(e.message, 'OK', { duration: 6000 }),
    });
  }

  /** Everyone who reports (directly or indirectly) to `id`. */
  private reports(id: string): string[] {
    const users = this.repo.users();
    const found = new Set<string>();
    let grew = true;
    while (grew) {
      grew = false;
      for (const u of users) {
        if (u.managerId && (u.managerId === id || found.has(u.managerId)) && !found.has(u.id)) {
          found.add(u.id);
          grew = true;
        }
      }
    }
    return [...found];
  }
}
