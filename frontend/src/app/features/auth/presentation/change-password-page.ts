import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { SessionService } from '../../../core/auth/session.service';
import { toApiError } from '../../../core/http/api-error';

/** Same rules as the server (which is what actually enforces them): shown to help, not to decide. */
const MIN_LENGTH = 12;

/**
 * Shown to a user whose admin set a temporary password: they must choose their own before
 * anything else works. The server blocks every other endpoint until then.
 */
@Component({
  selector: 'app-change-password-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  template: `
    <main class="wrap">
      <mat-card appearance="outlined" class="card">
        <h1>Choose your password</h1>
        <p class="sub">
          @if (forced()) {
            Your administrator gave you a temporary password. Choose your own to continue.
          } @else {
            Choose a new password.
          }
        </p>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <mat-form-field appearance="outline">
            <mat-label>{{ forced() ? 'Temporary password' : 'Current password' }}</mat-label>
            <input
              matInput
              type="password"
              formControlName="current"
              autocomplete="current-password"
            />
            @if (form.controls.current.invalid && form.controls.current.touched) {
              <mat-error>Required</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>New password</mat-label>
            <input matInput type="password" formControlName="next" autocomplete="new-password" />
            <mat-hint>12+ characters: upper, lower, digit, symbol</mat-hint>
            @if (form.controls.next.invalid && form.controls.next.touched) {
              <mat-error>Use at least {{ minLength }} characters</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Repeat new password</mat-label>
            <input matInput type="password" formControlName="repeat" autocomplete="new-password" />
            @if (form.hasError('mismatch') && form.controls.repeat.touched) {
              <mat-error>The passwords do not match</mat-error>
            }
          </mat-form-field>
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
          <div class="actions">
            <button mat-button type="button" (click)="signOut()">Sign out</button>
            <button mat-flat-button type="submit" [disabled]="saving()">
              <mat-icon>lock_reset</mat-icon> Save password
            </button>
          </div>
        </form>
      </mat-card>
    </main>
  `,
  styles: `
    .wrap {
      display: grid;
      place-items: center;
      min-height: 100dvh;
      padding: 1.25rem;
      background: var(--mat-sys-surface-container-lowest);
    }
    .card {
      width: min(28rem, 100%);
      padding: 1.5rem;
    }
    h1 {
      margin: 0 0 0.25rem;
      font: var(--mat-sys-headline-small);
    }
    .sub {
      margin: 0 0 1rem;
      color: var(--mat-sys-on-surface-variant);
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .error {
      margin: 0;
      color: var(--mat-sys-error);
      font: var(--mat-sys-body-medium);
    }
    .actions {
      display: flex;
      justify-content: space-between;
      margin-top: 0.75rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordPage {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly minLength = MIN_LENGTH;
  protected readonly forced = () => this.session.user()?.mustChangePassword === true;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      current: ['', Validators.required],
      next: ['', [Validators.required, Validators.minLength(MIN_LENGTH)]],
      repeat: ['', Validators.required],
    },
    {
      validators: (group) =>
        group.get('next')?.value === group.get('repeat')?.value ? null : { mismatch: true },
    },
  );

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const { current, next } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.auth.changePassword(current, next).subscribe({
      next: () => void this.router.navigateByUrl('/'),
      error: (e: unknown) => {
        this.saving.set(false);
        this.error.set(toApiError(e).message);
      },
    });
  }

  protected signOut(): void {
    this.auth.logout().subscribe({ error: () => undefined });
  }
}
