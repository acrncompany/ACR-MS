import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { dateToIso, isoToDate, provideDayFirstDatepicker } from '../../../shared/utils/date-picker';
import {
  AssignableStaff,
  Department,
  NewStaffInput,
  Position,
  Role,
  StaffMember,
} from '../domain/admin.models';
import { DepartmentInput, PositionInput } from '../domain/organization.repository';
import { StaffRepository } from '../domain/staff.repository';

/** Capital letters in groups joined by "_" or "-"; no digits, so a code never carries a level. */
const CODE = /^[A-Z]+([_-][A-Z]+)*$/;
const PHONE = /^[0-9+\-\s]{8,15}$/;

/** The CEO's short designation labels. Display only; never used for the hierarchy. */
const DESIGNATIONS = [
  { code: 'TM', label: 'Team Member' },
  { code: 'TL', label: 'Team Leader' },
  { code: 'TD', label: 'Team Director' },
  { code: 'AD', label: 'Admin' },
  { code: 'GM', label: 'General Manager' },
  { code: 'P1', label: 'Partner' },
] as const;

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

/** Position label with the CEO's display code, e.g. "Finance Officer (TL)". */
export function positionLabel(p: Pick<Position, 'title' | 'designationCode'>): string {
  return p.designationCode ? `${p.title} (${p.designationCode})` : p.title;
}

// ---------------------------------------------------------------- department

export interface DepartmentDialogData {
  title: string;
  department?: Department;
}

export interface DepartmentDialogResult {
  /** Present only when creating: the code is permanent afterwards. */
  code: string | null;
  input: DepartmentInput;
}

@Component({
  selector: 'app-department-dialog',
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
      <mat-dialog-content class="fields">
        <mat-form-field appearance="outline">
          <mat-label>Department name</mat-label>
          <input matInput formControlName="name" cdkFocusInitial />
          @if (form.controls.name.invalid) {
            <mat-error>Required</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Department code</mat-label>
          <input matInput formControlName="code" autocomplete="off" />
          <mat-hint>
            @if (data.department) {
              Permanent: the code cannot be changed
            } @else {
              For example OPS or FIN_OPS. Capital letters, "_" or "-". Permanent once saved
            }
          </mat-hint>
          @if (form.controls.code.invalid) {
            <mat-error>Required: capital letters, "_" or "-" only, no numbers</mat-error>
          }
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
      width: min(28rem, 90vw);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DepartmentDialog {
  protected readonly data = inject<DepartmentDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<DepartmentDialog, DepartmentDialogResult>);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.data.department?.name ?? '', [Validators.required, Validators.pattern(/\S/)]],
    // The code names the department permanently: it is only editable when creating.
    code: [
      { value: this.data.department?.code ?? '', disabled: !!this.data.department },
      [Validators.required, Validators.pattern(CODE)],
    ],
  });

  protected save(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.ref.close({
      code: this.data.department ? null : value.code.trim().toUpperCase(),
      input: { name: value.name.trim(), parentId: this.data.department?.parentId ?? null },
    } satisfies DepartmentDialogResult);
  }
}

// ---------------------------------------------------------------- position

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

export interface PositionDialogResult {
  /** Present only when creating: the code is permanent afterwards. */
  code: string | null;
  input: PositionInput;
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
          <mat-label>Position code</mat-label>
          <input matInput formControlName="code" autocomplete="off" />
          <mat-hint>
            @if (data.position) {
              Permanent: names the role, cannot be changed
            } @else {
              Names the role, e.g. FIN_OFFICER. Capital letters, "_" or "-". Permanent once saved
            }
          </mat-hint>
          @if (form.controls.code.invalid) {
            <mat-error>Required: capital letters, "_" or "-" only, no numbers</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Designation label</mat-label>
          <mat-select formControlName="designationCode">
            <mat-option [value]="null">None</mat-option>
            @for (d of designations; track d.code) {
              <mat-option [value]="d.code">{{ d.code }} · {{ d.label }}</mat-option>
            }
          </mat-select>
          <mat-hint>Display only. The hierarchy comes from "Reports to"</mat-hint>
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
      width: min(30rem, 90vw);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PositionDialog {
  protected readonly data = inject<PositionDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<PositionDialog, PositionDialogResult>);
  protected readonly designations = DESIGNATIONS;
  protected readonly parents = this.data.positions.filter(
    (p) => !(this.data.excludedParents ?? []).includes(p.id),
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    title: [this.data.position?.title ?? '', [Validators.required, Validators.pattern(/\S/)]],
    // The code names the role permanently: it is only editable when creating.
    code: [
      { value: this.data.position?.code ?? '', disabled: !!this.data.position },
      [Validators.required, Validators.pattern(CODE)],
    ],
    designationCode: new FormControl<string | null>(this.data.position?.designationCode ?? null),
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
      code: this.data.position ? null : value.code.trim().toUpperCase(),
      input: {
        title: value.title.trim(),
        designationCode: value.designationCode,
        departmentId: value.departmentId,
        parentId: value.parentId,
        roleId: value.roleId,
      },
    } satisfies PositionDialogResult);
  }
}

// ---------------------------------------------------------------- staff

export interface UserDialogData {
  title: string;
  /** Positions that may be chosen (when adding: only those the server says the caller may create). */
  positions: Position[];
  /** Active people for the manager dropdown (the current manager stays listed). */
  managers: AssignableStaff[];
  user?: StaffMember;
  /** The signed-in user may change position and manager (Board/GM with the move permission). */
  canMove: boolean;
}

export interface UserDialogResult {
  input: Omit<NewStaffInput, 'password' | 'generateTemporaryPassword'>;
  /** Only when creating. */
  password?: string;
  generateTemporaryPassword?: boolean;
}

@Component({
  selector: 'app-user-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  providers: [provideDayFirstDatepicker()],
  template: `
    <h2 mat-dialog-title>
      {{ data.title }}
      @if (data.user) {
        <span class="code">{{ data.user.employeeCode }}</span>
      }
    </h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="fields">
        <mat-form-field appearance="outline">
          <mat-label>Code</mat-label>
          <input matInput [value]="data.user?.employeeCode ?? nextCode() ?? '...'" disabled />
        </mat-form-field>
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
          <mat-label>Phone</mat-label>
          <input matInput type="tel" formControlName="phone" />
          @if (form.controls.phone.invalid) {
            <mat-error>Enter a valid phone number</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Address</mat-label>
          <textarea matInput rows="2" formControlName="address"></textarea>
        </mat-form-field>
        <div class="pair">
          <mat-form-field appearance="outline">
            <mat-label>Date of birth</mat-label>
            <input matInput [matDatepicker]="dob" [max]="today" formControlName="dateOfBirth" />
            <mat-datepicker-toggle matIconSuffix [for]="dob" />
            <mat-datepicker #dob startView="multi-year" />
            <mat-hint>dd/MM/yyyy</mat-hint>
            @if (form.controls.dateOfBirth.invalid) {
              <mat-error>Enter a valid past date</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Date of joining</mat-label>
            <input matInput [matDatepicker]="doj" formControlName="dateOfJoining" />
            <mat-datepicker-toggle matIconSuffix [for]="doj" />
            <mat-datepicker #doj />
            <mat-hint>dd/MM/yyyy</mat-hint>
            @if (form.controls.dateOfJoining.invalid) {
              <mat-error>Enter a valid date, not before the date of birth</mat-error>
            }
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>Position</mat-label>
          <mat-select formControlName="positionId" (selectionChange)="suggestManager($event.value)">
            @for (p of data.positions; track p.id) {
              <mat-option [value]="p.id">{{ label(p) }}</mat-option>
            }
          </mat-select>
          @if (form.controls.positionId.disabled) {
            <mat-hint>Only the Board can change a person's position</mat-hint>
          }
        </mat-form-field>
        @if (data.canMove) {
          <mat-form-field appearance="outline">
            <mat-label>Reporting manager</mat-label>
            <mat-select formControlName="managerId">
              <mat-option [value]="null">Nobody</mat-option>
              @for (u of managers; track u.id) {
                <mat-option [value]="u.id">{{ u.name }} ({{ u.employeeCode }})</mat-option>
              }
            </mat-select>
          </mat-form-field>
        } @else if (!data.user) {
          <p class="hint">The new person will report to you.</p>
        }
        @if (!data.user) {
          <mat-slide-toggle [checked]="generate()" (change)="generate.set($event.checked)">
            Generate a temporary password (shown once)
          </mat-slide-toggle>
          @if (!generate()) {
            <mat-form-field appearance="outline" class="pw">
              <mat-label>Temporary password</mat-label>
              <input
                matInput
                type="password"
                formControlName="password"
                autocomplete="new-password"
              />
              <mat-hint
                >At least 12 characters, upper and lower case, a digit and a symbol</mat-hint
              >
              @if (form.controls.password.invalid) {
                <mat-error>Use at least 12 characters</mat-error>
              }
            </mat-form-field>
          }
          <p class="hint">The person must choose their own password at first sign-in.</p>
        }
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
      width: min(34rem, 90vw);
    }
    .pair {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    @media (max-width: 600px) {
      .pair {
        grid-template-columns: 1fr;
      }
    }
    .pw {
      margin-top: 0.5rem;
    }
    .code {
      margin-left: 0.5rem;
      padding: 0.1rem 0.6rem;
      border-radius: 999px;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font: var(--mat-sys-label-large);
      white-space: nowrap;
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
  private readonly ref = inject(MatDialogRef<UserDialog, UserDialogResult>);
  protected readonly today = new Date();
  protected readonly label = positionLabel;
  protected readonly generate = signal(true);
  protected readonly nextCode = signal<string | null>(null);
  protected readonly managers = this.data.managers.filter((u) => u.id !== this.data.user?.id);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.data.user?.name ?? '', [Validators.required, Validators.pattern(/\S/)]],
    email: [this.data.user?.email ?? '', [Validators.required, Validators.email]],
    phone: [this.data.user?.phone ?? '', Validators.pattern(PHONE)],
    address: [this.data.user?.address ?? ''],
    dateOfBirth: new FormControl<Date | null>(isoToDate(this.data.user?.dateOfBirth)),
    dateOfJoining: new FormControl<Date | null>(isoToDate(this.data.user?.dateOfJoining)),
    positionId: [
      this.data.user?.positionId ?? this.data.positions[0]?.id ?? '',
      Validators.required,
    ],
    managerId: new FormControl<string | null>(this.data.user?.managerId ?? null),
    password: [''],
  });

  /** When adding as Board/GM, default the manager to someone in the position's parent position. */
  protected suggestManager(positionId: string): void {
    if (this.data.user || !this.data.canMove) return;
    const parentId = this.data.positions.find((p) => p.id === positionId)?.parentId;
    const manager = this.data.managers.find((u) => {
      const position = this.data.positions.find((p) => p.id === u.positionId);
      return position?.id === parentId;
    });
    this.form.controls.managerId.setValue(manager?.id ?? null);
  }

  constructor() {
    // Preview only: the server issues the real employee code when the person is saved.
    if (!this.data.user) {
      inject(StaffRepository)
        .nextCode()
        .subscribe({ next: (code) => this.nextCode.set(code), error: () => undefined });
    }
    // Position and manager only change through the Board; the server enforces it too.
    if (this.data.user && !this.data.canMove) this.form.controls.positionId.disable();
    // Date of birth must be in the past; joining cannot be before birth.
    this.form.controls.dateOfBirth.addValidators((c) =>
      c.value && c.value > this.today ? { future: true } : null,
    );
    this.form.controls.dateOfJoining.addValidators((c) => {
      const born = this.form.controls.dateOfBirth.value;
      return c.value && born && c.value < born ? { beforeBirth: true } : null;
    });
    this.form.controls.dateOfBirth.valueChanges.subscribe(() =>
      this.form.controls.dateOfJoining.updateValueAndValidity(),
    );
    // The password is only needed when an admin chooses it instead of generating one.
    this.form.controls.password.addValidators((c) =>
      !this.data.user && !this.generate() && String(c.value).length < 12 ? { short: true } : null,
    );
  }

  protected save(): void {
    this.form.controls.password.updateValueAndValidity();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.ref.close({
      input: {
        name: value.name.trim(),
        email: value.email.trim(),
        phone: value.phone.trim() || null,
        address: value.address.trim() || null,
        dateOfBirth: dateToIso(value.dateOfBirth) || null,
        dateOfJoining: dateToIso(value.dateOfJoining) || null,
        positionId: value.positionId,
        managerId: value.managerId,
      },
      ...(this.data.user
        ? {}
        : this.generate()
          ? { generateTemporaryPassword: true }
          : { password: value.password }),
    } satisfies UserDialogResult);
  }
}

// ---------------------------------------------------------------- temporary password

export interface TemporaryPasswordDialogData {
  name: string;
  employeeCode: string;
  email: string;
  password: string;
}

/** Shows a generated temporary password ONCE. It is not stored anywhere and cannot be shown again. */
@Component({
  selector: 'app-temporary-password-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Temporary password</h2>
    <mat-dialog-content>
      <p>
        {{ data.name }} ({{ data.employeeCode }}) was created. Give them this temporary password for
        <strong>{{ data.email }}</strong
        >. They must choose their own at first sign-in.
      </p>
      <p class="secret" aria-live="polite">
        <code>{{ data.password }}</code>
        <button mat-button type="button" (click)="copy()">
          <mat-icon>content_copy</mat-icon> {{ copied() ? 'Copied' : 'Copy' }}
        </button>
      </p>
      <p class="warn">
        This is the only time it is shown. It is not stored and cannot be retrieved later.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" mat-dialog-close cdkFocusInitial>
        I have noted it
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .secret {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: 12px;
      background: var(--mat-sys-surface-container);
    }
    code {
      font-size: 1.1rem;
      letter-spacing: 0.04em;
      user-select: all;
    }
    .warn {
      color: var(--mat-sys-error);
      font: var(--mat-sys-body-small);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemporaryPasswordDialog {
  protected readonly data = inject<TemporaryPasswordDialogData>(MAT_DIALOG_DATA);
  protected readonly copied = signal(false);

  protected copy(): void {
    void navigator.clipboard?.writeText(this.data.password).then(() => this.copied.set(true));
  }
}
