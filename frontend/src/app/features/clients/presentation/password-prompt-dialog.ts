import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface PasswordPromptData {
  title: string;
  message: string;
  confirmLabel: string;
}

/**
 * Asks for the signed-in user's CURRENT password (re-authentication before a sensitive action,
 * such as revealing a client's portal password). Returns the password, or nothing if cancelled.
 * The password is never kept: it only travels in the request that needs it.
 */
@Component({
  selector: 'app-password-prompt-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content>
        <p>{{ data.message }}</p>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Your password</mat-label>
          <input
            matInput
            type="password"
            formControlName="password"
            autocomplete="current-password"
            cdkFocusInitial
          />
          @if (form.controls.password.invalid && form.controls.password.touched) {
            <mat-error>Enter your password</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit">{{ data.confirmLabel }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .full {
      width: min(28rem, 90vw);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordPromptDialog {
  protected readonly data = inject<PasswordPromptData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<PasswordPromptDialog, string>);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    password: ['', Validators.required],
  });

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.valid) this.ref.close(this.form.controls.password.value);
  }
}
