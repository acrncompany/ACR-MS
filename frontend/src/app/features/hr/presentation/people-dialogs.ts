import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  DepartmentInput,
  DesignationInput,
  DirectoryKind,
  DirectoryOption,
  DirectoryStatus,
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
