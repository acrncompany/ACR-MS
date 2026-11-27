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
import { formatDate } from '../../../shared/utils/date';
import { Client } from '../domain/client.models';
import { ClientRepository } from '../domain/client.repository';

/**
 * Printable client summary. Portal credentials are deliberately never part of it (and are not
 * even loaded here).
 */
@Component({
  selector: 'app-client-print-page',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  template: `
    @if (client(); as c) {
      <div class="toolbar">
        <a mat-stroked-button [routerLink]="['/masters/clients', c.id]">
          <mat-icon>arrow_back</mat-icon> Back to client
        </a>
        <button mat-flat-button type="button" (click)="print()">
          <mat-icon>print</mat-icon> Print
        </button>
      </div>

      <article class="paper">
        <header class="title">
          <span class="firm">{{ firm }}</span>
          <h1>CLIENT SUMMARY</h1>
        </header>

        <table class="box">
          <tr>
            <th>Client code</th>
            <td>{{ c.clientCode }}</td>
            <th>Status</th>
            <td>{{ c.active ? 'Active' : 'Inactive' }}</td>
          </tr>
          <tr>
            <th>Name</th>
            <td colspan="3">{{ c.name }}</td>
          </tr>
          <tr>
            <th>Organisation type</th>
            <td>{{ c.organisationTypeLabel }}</td>
            <th>CIN / FRN</th>
            <td>{{ c.cinFrn }}</td>
          </tr>
          <tr>
            <th>Date of incorporation / formation</th>
            <td>{{ date(c.incorporationDate) }}</td>
            <th>PAN / GSTIN</th>
            <td>{{ c.pan }} {{ c.gstin }}</td>
          </tr>
          <tr>
            <th>Email</th>
            <td>{{ c.email }}</td>
            <th>Phone</th>
            <td>{{ c.phone }}</td>
          </tr>
          <tr>
            <th>Address</th>
            <td colspan="3">{{ c.address }}{{ c.city ? ', ' + c.city : '' }}</td>
          </tr>
          <tr>
            <th>Previous auditor</th>
            <td>{{ c.previousAuditor }}</td>
            <th>Assigned team</th>
            <td>{{ c.team.join(', ') }}</td>
          </tr>
        </table>

        <h2>Directors / partners</h2>
        <table class="box">
          <tr>
            <th>Name</th>
            <th>DIN</th>
            <th>Phone</th>
            <th>Email</th>
            <th>KYC</th>
          </tr>
          @for (d of c.directors; track d.id) {
            <tr>
              <td>{{ d.name }}</td>
              <td>{{ d.din }}</td>
              <td>{{ d.phone }}</td>
              <td>{{ d.email }}</td>
              <td>{{ d.kycStatus === 'done' ? 'Done' : 'Pending' }}</td>
            </tr>
          }
        </table>

        <h2>Applicable laws</h2>
        <p class="laws">{{ c.lawKeys.join(', ') || 'None selected' }}</p>

        <p class="note">
          Client portal credentials are held on the client record and are not printed.
        </p>
      </article>
    } @else if (error(); as message) {
      <p class="missing" role="alert">{{ message }}</p>
    } @else {
      <p class="missing" role="status">Loading…</p>
    }
  `,
  styleUrl: './client-print-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientPrintPage {
  readonly id = input.required<string>();

  private readonly repo = inject(ClientRepository);
  private readonly cfg = inject(AppConfigService).config;
  protected readonly firm = this.cfg.branding.productName;
  protected readonly client = signal<Client | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() =>
        this.repo.get(id).subscribe({
          next: (c) => this.client.set(c),
          error: (e: unknown) => this.error.set(toApiError(e).message),
        }),
      );
    });
  }

  protected date(iso: string): string {
    return formatDate(iso, this.cfg.locale.locale);
  }

  protected print(): void {
    window.print();
  }
}
