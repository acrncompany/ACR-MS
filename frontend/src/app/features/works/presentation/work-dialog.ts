import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { WorkEntry, WorkInput } from '../domain/work.models';
import { WorkRepository } from '../domain/work.repository';

/**
 * Creates or edits (when given an entry) an works. The code is issued by the server and
 * never changes, so it is never an input.
 */
@Component({
  selector: 'app-work-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ existing ? 'Edit work' : 'New work' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="fields">
        <mat-form-field appearance="outline">
          <mat-label>Code</mat-label>
          <input matInput [value]="existing?.code ?? nextCode() ?? '...'" disabled />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" maxlength="100" cdkFocusInitial />
          @if (form.controls.name.invalid) {
            <mat-error>Required</mat-error>
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
export class WorkDialog {
  private readonly ref = inject(MatDialogRef<WorkDialog, WorkInput>);
  protected readonly existing = inject<WorkEntry | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  protected readonly nextCode = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.existing?.name ?? '', [Validators.required, Validators.pattern(/\S/)]],
  });

  constructor() {
    // Preview only: the server issues the real code when the type is saved.
    if (!this.existing) {
      inject(WorkRepository)
        .nextCode()
        .subscribe({ next: (code) => this.nextCode.set(code), error: () => undefined });
    }
  }

  protected save(): void {
    if (this.form.invalid) return;
    this.ref.close({ name: this.form.getRawValue().name.trim() } satisfies WorkInput);
  }
}
