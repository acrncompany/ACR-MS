import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { dateToIso, provideDayFirstDatepicker } from '../../../shared/utils/date-picker';
import {
  DepartmentInput,
  DesignationInput,
  DirectoryKind,
  DirectoryOption,
  DirectoryStatus,
  EmployeeInput,
} from '../domain/people-directory.models';
import { PeopleDirectoryRepository } from '../domain/people-directory.repository';

const STATUSES: DirectoryStatus[] = ['Active', 'Inactive'];
const notBlank = [Validators.required, Validators.pattern(/\S/)];

const DIALOG_STYLES = `
  .fields {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: min(30rem, 90vw);
  }
`;

/** Preview only: the server issues the real code when the row is saved. */
function previewCode(repo: PeopleDirectoryRepository, kind: DirectoryKind) {
  const code = signal<string | null>(null);
  repo.nextCode(kind).subscribe({ next: (c) => code.set(c), error: () => undefined });
  return code;
}

@Component({
  selector: 'app-department-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>New department</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="fields">
        <mat-form-field appearance="outline">
          <mat-label>Code</mat-label>
          <input matInput [value]="code() ?? '...'" disabled />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" maxlength="100" cdkFocusInitial />
          <mat-error>Required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="3" maxlength="300"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Status</mat-label>
          <mat-select formControlName="status">
            @for (s of statuses; track s) {
              <mat-option [value]="s">{{ s }}</mat-option>
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
  styles: DIALOG_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DepartmentDialog {
  private readonly ref = inject(MatDialogRef<DepartmentDialog, DepartmentInput>);
  protected readonly code = previewCode(inject(PeopleDirectoryRepository), 'department');
  protected readonly statuses = STATUSES;
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', notBlank],
    description: [''],
    status: ['Active' as DirectoryStatus],
  });

  protected save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.ref.close({
      name: v.name.trim(),
      description: v.description.trim(),
      status: v.status,
    } satisfies DepartmentInput);
  }
}

@Component({
  selector: 'app-designation-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>New designation</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="fields">
        <mat-form-field appearance="outline">
          <mat-label>Code</mat-label>
          <input matInput [value]="code() ?? '...'" disabled />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" maxlength="100" cdkFocusInitial />
          <mat-error>Required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Department</mat-label>
          <mat-select formControlName="departmentId">
            @for (d of departments(); track d.id) {
              <mat-option [value]="d.id">{{ d.name }}</mat-option>
            }
          </mat-select>
          @if (loaded() && !departments().length) {
            <mat-hint>Add a department first</mat-hint>
          }
          <mat-error>Required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="3" maxlength="300"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Status</mat-label>
          <mat-select formControlName="status">
            @for (s of statuses; track s) {
              <mat-option [value]="s">{{ s }}</mat-option>
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
  styles: DIALOG_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignationDialog {
  private readonly ref = inject(MatDialogRef<DesignationDialog, DesignationInput>);
  private readonly repo = inject(PeopleDirectoryRepository);
  protected readonly code = previewCode(this.repo, 'designation');
  protected readonly statuses = STATUSES;
  // Only active departments are offered.
  protected readonly departments = signal<DirectoryOption[]>([]);
  protected readonly loaded = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', notBlank],
    departmentId: ['', Validators.required],
    description: [''],
    status: ['Active' as DirectoryStatus],
  });

  constructor() {
    this.repo.departmentOptions().subscribe({
      next: (options) => {
        this.departments.set(options);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  protected save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.ref.close({
      name: v.name.trim(),
      departmentId: v.departmentId,
      description: v.description.trim(),
      status: v.status,
    } satisfies DesignationInput);
  }
}

@Component({
  selector: 'app-employee-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  providers: [provideDayFirstDatepicker()],
  template: `
    <h2 mat-dialog-title>New employee</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="fields">
        <mat-form-field appearance="outline">
          <mat-label>Code</mat-label>
          <input matInput [value]="code() ?? '...'" disabled />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" maxlength="100" cdkFocusInitial />
          <mat-error>Required</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" maxlength="200" />
          <mat-error>Enter a valid email</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Phone</mat-label>
          <input matInput type="tel" formControlName="phone" maxlength="20" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Department</mat-label>
          <mat-select formControlName="departmentId">
            <mat-option [value]="null">None</mat-option>
            @for (d of departments(); track d.id) {
              <mat-option [value]="d.id">{{ d.name }}</mat-option>
            }
          </mat-select>
          @if (loaded() && !departments().length) {
            <mat-hint>Add a department first</mat-hint>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Designation</mat-label>
          <mat-select formControlName="designationId">
            <mat-option [value]="null">None</mat-option>
            @for (d of designations(); track d.id) {
              <mat-option [value]="d.id">{{ d.name }}</mat-option>
            }
          </mat-select>
          @if (loaded() && !designations().length) {
            <mat-hint>Add a designation first</mat-hint>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Joining date</mat-label>
          <input matInput [matDatepicker]="picker" formControlName="joinDate" />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
          <mat-error>Required (dd/MM/yyyy)</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Status</mat-label>
          <mat-select formControlName="status">
            @for (s of statuses; track s) {
              <mat-option [value]="s">{{ s }}</mat-option>
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
  styles: DIALOG_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeDialog {
  private readonly ref = inject(MatDialogRef<EmployeeDialog, EmployeeInput>);
  private readonly repo = inject(PeopleDirectoryRepository);
  protected readonly code = previewCode(this.repo, 'employee');
  protected readonly statuses = STATUSES;
  protected readonly loaded = signal(false);
  // Only active entries are offered for a new employee.
  protected readonly departments = signal<DirectoryOption[]>([]);
  private readonly allDesignations = signal<DirectoryOption[]>([]);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', notBlank],
    email: ['', [Validators.email]],
    phone: [''],
    departmentId: new FormControl<string | null>(null),
    designationId: new FormControl<string | null>(null),
    joinDate: [null as Date | null, Validators.required],
    status: ['Active' as DirectoryStatus],
  });

  private readonly selectedDepartment = toSignal(this.form.controls.departmentId.valueChanges, {
    initialValue: null,
  });
  /** A designation belongs to one department: once a department is chosen, only its ones show. */
  protected readonly designations = computed(() => {
    const department = this.selectedDepartment();
    const all = this.allDesignations();
    return department ? all.filter((d) => d.departmentId === department) : all;
  });

  constructor() {
    let pending = 2;
    const done = () => --pending === 0 && this.loaded.set(true);
    this.repo.departmentOptions().subscribe({
      next: (options) => {
        this.departments.set(options);
        done();
      },
      error: done,
    });
    this.repo.designationOptions().subscribe({
      next: (options) => {
        this.allDesignations.set(options);
        done();
      },
      error: done,
    });
    // Changing the department clears a designation that does not belong to it.
    this.form.controls.departmentId.valueChanges.subscribe(() => {
      const chosen = this.form.controls.designationId.value;
      if (chosen && !this.designations().some((d) => d.id === chosen)) {
        this.form.controls.designationId.setValue(null);
      }
    });
    // Choosing a designation first fills in its department.
    this.form.controls.designationId.valueChanges.subscribe((id) => {
      const owner = this.allDesignations().find((d) => d.id === id)?.departmentId;
      if (owner && this.form.controls.departmentId.value !== owner) {
        this.form.controls.departmentId.setValue(owner);
      }
    });
  }

  protected save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.ref.close({
      name: v.name.trim(),
      email: v.email.trim(),
      phone: v.phone.trim(),
      departmentId: v.departmentId,
      designationId: v.designationId,
      joinDate: dateToIso(v.joinDate),
      status: v.status,
    } satisfies EmployeeInput);
  }
}
