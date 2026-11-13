import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AppConfigService } from '../../../core/config/app-config.service';
import { SessionService } from '../../../core/auth/session.service';
import { DemoAccount } from '../domain/auth.models';
import { AuthRepository } from '../domain/auth.repository';

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
  ],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthRepository);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  private readonly appConfig = inject(AppConfigService).config;
  protected readonly branding = this.appConfig.branding;
  protected readonly highlights = this.appConfig.branding.highlights ?? [];
  /** Quick login is offered only in mock mode, and only if the repository provides accounts. */
  protected readonly demoAccounts = this.appConfig.mockMode ? this.auth.demoAccounts : [];
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

  /** Only fills the form; the user still has to press "Sign in". */
  protected fillDemo(account: DemoAccount): void {
    this.form.setValue({ email: account.email, password: account.password });
    this.error.set(null);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: (session) => {
        this.session.start(session);
        void this.router.navigateByUrl('/');
      },
      error: (e: Error) => {
        this.error.set(e.message || 'Sign in failed');
        this.loading.set(false);
      },
    });
  }
}
