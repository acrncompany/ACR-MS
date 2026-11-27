import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AppConfigService } from '../../../core/config/app-config.service';
import { toApiError } from '../../../core/http/api-error';
import { StaffRepository } from '../domain/staff.repository';
import { StaffView, buildStaffView } from './staff-view';

/** Printable staff summary (outside the shell so the sidebar and header never print). */
@Component({
  selector: 'app-staff-print-page',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  template: `
    @if (staff(); as s) {
      <div class="toolbar">
        <a mat-stroked-button routerLink="/admin/users">
          <mat-icon>arrow_back</mat-icon> Back to users
        </a>
        <button mat-flat-button type="button" (click)="print()">
          <mat-icon>print</mat-icon> Print
        </button>
      </div>

      <article class="paper">
        <header class="title">
          <span class="firm">{{ firm }}</span>
          <h1>STAFF SUMMARY</h1>
        </header>

        <table class="box">
          <tr>
            <th>Employee code</th>
            <td>{{ s.employeeCode }}</td>
            <th>Status</th>
            <td>{{ s.status }}</td>
          </tr>
          <tr>
            <th>Name</th>
            <td colspan="3">{{ s.name }}</td>
          </tr>
          <tr>
            <th>Position</th>
            <td>{{ s.position }}</td>
            <th>Designation label</th>
            <td>{{ s.designationCode }}</td>
          </tr>
          <tr>
            <th>Department</th>
            <td>{{ s.department }}</td>
            <th>Reports to</th>
            <td>{{ s.manager }}</td>
          </tr>
          <tr>
            <th>Email</th>
            <td>{{ s.email }}</td>
            <th>Phone</th>
            <td>{{ s.phone }}</td>
          </tr>
          <tr>
            <th>Date of birth</th>
            <td>{{ s.dateOfBirth }}</td>
            <th>Date of joining</th>
            <td>{{ s.dateOfJoining }}</td>
          </tr>
          <tr>
            <th>Address</th>
            <td colspan="3">{{ s.address }}</td>
          </tr>
        </table>
      </article>
    } @else if (error()) {
      <p class="missing" role="alert">{{ error() }}</p>
    } @else {
      <p class="missing" role="status">Loading…</p>
    }
  `,
  styleUrl: './staff-print-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffPrintPage {
  readonly id = input.required<string>();

  private readonly repo = inject(StaffRepository);
  private readonly cfg = inject(AppConfigService).config;
  protected readonly firm = this.cfg.branding.productName;
  protected readonly staff = signal<StaffView | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() =>
        this.repo.get(id).subscribe({
          next: (user) => this.staff.set(buildStaffView(user, this.cfg.locale.locale)),
          error: (e: unknown) => this.error.set(toApiError(e).message),
        }),
      );
    });
  }

  protected print(): void {
    window.print();
  }
}
