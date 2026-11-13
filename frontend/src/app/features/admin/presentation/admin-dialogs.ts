import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Department, DirectoryUser, Position, Role } from '../domain/admin.models';

export interface NameDialogData {
  title: string;
  label: string;
  value?: string;
  confirmLabel?: string;
}

@Component({
  selector: 'app-name-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full">
          <mat-label>{{ data.label }}</mat-label>
          <input matInput formControlName="name" cdkFocusInitial />
          @if (form.controls.name.invalid) {
            <mat-error>Required</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid">
          {{ data.confirmLabel ?? 'Save' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .full {
      width: min(24rem, 80vw);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NameDialog {
  protected readonly data = inject<NameDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<NameDialog, string>);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.data.value ?? '', [Validators.required, Validators.pattern(/\S/)]],
  });

  protected save(): void {
    if (this.form.valid) this.ref.close(this.form.controls.name.value.trim());
  }
}

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel: string;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancel</button>
      <button mat-flat-button type="button" [mat-dialog-close]="true" cdkFocusInitial>
        {{ data.confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}

export interface PositionDialogData {
  title: string;
  departments: Department[];
  roles: Role[];
  positions: Position[];
  /** Existing position being edited; omitted when adding. */
  position?: Position;
  /** Default parent when adding a report. */
  parentId?: string | null;
  /** Ids that cannot be chosen as parent (the position itself and everything below it). */
  excludedParents?: string[];
}

@Component({
  selector: 'app-position-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="fields">
        <mat-form-field appearance="outline">
          <mat-label>Position title</mat-label>
          <input matInput formControlName="title" cdkFocusInitial />
          @if (form.controls.title.invalid) {
            <mat-error>Required</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Department</mat-label>
          <mat-select formControlName="departmentId">
            @for (d of data.departments; track d.id) {
              <mat-option [value]="d.id">{{ d.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Reports to</mat-label>
          <mat-select formControlName="parentId">
            <mat-option [value]="null">Nobody (top level)</mat-option>
            @for (p of parents; track p.id) {
              <mat-option [value]="p.id">{{ p.title }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Role (permissions)</mat-label>
          <mat-select formControlName="roleId">
            @for (r of data.roles; track r.id) {
              <mat-option [value]="r.id">{{ r.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid">Save</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .fields {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      width: min(26rem, 80vw);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PositionDialog {
  protected readonly data = inject<PositionDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<PositionDialog, Omit<Position, 'id'>>);
  protected readonly parents = this.data.positions.filter(
    (p) => !(this.data.excludedParents ?? []).includes(p.id),
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    title: [this.data.position?.title ?? '', [Validators.required, Validators.pattern(/\S/)]],
    departmentId: [
      this.data.position?.departmentId ?? this.data.departments[0]?.id ?? '',
      Validators.required,
    ],
    parentId: new FormControl<string | null>(
      this.data.position ? this.data.position.parentId : (this.data.parentId ?? null),
    ),
    roleId: [this.data.position?.roleId ?? this.data.roles[0]?.id ?? '', Validators.required],
  });

  protected save(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.ref.close({
      title: value.title.trim(),
      departmentId: value.departmentId,
      parentId: value.parentId,
      roleId: value.roleId,
    });
  }
}

export interface UserDialogData {
  title: string;
  positions: Position[];
  users: DirectoryUser[];
  user?: DirectoryUser;
  /** Ids that cannot be chosen as manager (the user and their reports). */
  excludedManagers?: string[];
  /** Non-Board users: the position and manager are fixed (new people report to the creator). */
  restricted?: boolean;
}

@Component({
  selector: 'app-user-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="fields">
        <mat-form-field appearance="outline">
          <mat-label>Full name</mat-label>
          <input matInput formControlName="name" cdkFocusInitial />
          @if (form.controls.name.invalid) {
            <mat-error>Required</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" />
          @if (form.controls.email.invalid) {
            <mat-error>Enter a valid email address</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Position</mat-label>
          <mat-select formControlName="positionId" (selectionChange)="suggestManager($event.value)">
            @for (p of data.positions; track p.id) {
              <mat-option [value]="p.id">{{ p.title }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (!data.restricted) {
          <mat-form-field appearance="outline">
            <mat-label>Reporting manager</mat-label>
            <mat-select formControlName="managerId">
              <mat-option [value]="null">Nobody</mat-option>
              @for (u of managers; track u.id) {
                <mat-option [value]="u.id">{{ u.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        } @else if (!data.user) {
          <p class="hint">The new person will report to you.</p>
        }
        <mat-slide-toggle formControlName="active">Active</mat-slide-toggle>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit" [disabled]="form.invalid">Save</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .fields {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      width: min(26rem, 80vw);
    }
    .hint {
      margin: 0 0 0.75rem;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserDialog {
  protected readonly data = inject<UserDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<UserDialog, Omit<DirectoryUser, 'id'>>);
  protected readonly managers = this.data.users.filter(
    (u) => u.id !== this.data.user?.id && !(this.data.excludedManagers ?? []).includes(u.id),
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.data.user?.name ?? '', [Validators.required, Validators.pattern(/\S/)]],
    email: [this.data.user?.email ?? '', [Validators.required, Validators.email]],
    positionId: [
      this.data.user?.positionId ?? this.data.positions[0]?.id ?? '',
      Validators.required,
    ],
    managerId: new FormControl<string | null>(this.data.user?.managerId ?? null),
    active: [this.data.user?.active ?? true],
  });

  /** When adding, default the manager to someone in the position's parent position. */
  protected suggestManager(positionId: string): void {
    if (this.data.user) return;
    const parentId = this.data.positions.find((p) => p.id === positionId)?.parentId;
    const manager = this.data.users.find((u) => u.positionId === parentId && u.active);
    this.form.controls.managerId.setValue(manager?.id ?? null);
  }

  constructor() {
    // The reporting line is set by who creates the person; only the Board can change it.
    if (this.data.restricted && this.data.user) this.form.controls.positionId.disable();
  }

  protected save(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.ref.close({
      name: value.name.trim(),
      email: value.email.trim(),
      positionId: value.positionId,
      managerId: value.managerId,
      active: value.active,
    });
  }
}
