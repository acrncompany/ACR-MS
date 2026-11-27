import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AppConfigService } from '../../../core/config/app-config.service';
import { AuthService } from '../../../core/auth/auth.service';
import { DEV_QUICK_LOGINS } from '../data/dev-quick-logins';
import { DemoAccount } from '../domain/auth.models';
import { AuthRepository } from '../domain/auth.repository';

/** Set by Angular's build: false in production builds, so dev-only code below is dropped. */
declare const ngDevMode: boolean | object;

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly repo = inject(AuthRepository);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly appConfig = inject(AppConfigService).config;
  protected readonly branding = this.appConfig.branding;
  protected readonly highlights = this.appConfig.branding.highlights ?? [];
  /**
   * Quick login is for development builds only: the buttons fill ONLY the email of a seeded demo
   * user (the password is SEED_DEMO_PASSWORD and is typed by the developer).
   */
  protected readonly demoAccounts: readonly DemoAccount[] = ngDevMode ? DEV_QUICK_LOGINS : [];
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly hidePassword = signal(true);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected invalid(name: 'email' | 'password'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  /** Only fills the form; the user still has to press "Sign in" (and type any missing password). */
  protected fillDemo(account: DemoAccount): void {
    this.form.setValue({ email: account.email, password: account.password ?? '' });
    this.error.set(null);
    if (account.password === undefined) {
      document.getElementById('login-password')?.focus();
    }
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => void this.router.navigateByUrl('/'),
      error: (e: unknown) => {
        this.error.set(this.messageFor(e));
        this.loading.set(false);
      },
    });
  }

  private messageFor(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0)
        return 'Cannot reach the server. Check your connection and try again.';
      if (error.status === 429) return 'Too many attempts. Please wait a minute and try again.';
      if (error.status === 401) return 'Invalid credentials';
      if (error.status === 404) return 'This address is not set up for a company.';
    }
    // The mock repository throws plain errors with a readable message.
    return error instanceof Error && error.message ? error.message : 'Sign in failed';
  }
}
