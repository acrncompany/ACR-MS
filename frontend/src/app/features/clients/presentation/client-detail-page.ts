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
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../../core/auth/session.service';
import { AppConfigService } from '../../../core/config/app-config.service';
import { toApiError } from '../../../core/http/api-error';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { formatDate } from '../../../shared/utils/date';
import { Client } from '../domain/client.models';
import { ClientRepository } from '../domain/client.repository';
import { CredentialsCard } from './credentials-card';

/** Client master record: profile, directors, laws and portal credentials. */
@Component({
  selector: 'app-client-detail-page',
  imports: [CredentialsCard, MatButtonModule, MatCardModule, MatIconModule, PageHeader, RouterLink],
  template: `
    @if (client(); as c) {
      <app-page-header [title]="c.name" [badge]="c.clientCode">
        <a mat-stroked-button routerLink="/masters/clients">
          <mat-icon>arrow_back</mat-icon> All clients
        </a>
        <a mat-stroked-button [routerLink]="['/print/clients', c.id]">
          <mat-icon>print</mat-icon> Print
        </a>
        @if (canEdit) {
          <a mat-stroked-button [routerLink]="['/masters/clients', c.id, 'edit']">
            <mat-icon>edit</mat-icon> Edit
          </a>
        }
        @if (canDeactivate) {
          <button mat-stroked-button type="button" (click)="toggleActive(c)">
            <mat-icon>{{ c.active ? 'block' : 'check_circle' }}</mat-icon>
            {{ c.active ? 'Deactivate' : 'Reactivate' }}
          </button>
        }
      </app-page-header>

      @if (!c.active) {
        <p class="banner" role="status">
          <mat-icon>block</mat-icon>
          This client is deactivated. It is not offered for new work sheets; old sheets are kept.
        </p>
      }

      <mat-card appearance="outlined" class="card">
        <h2>Profile</h2>
        <dl class="facts">
          <div>
            <dt>Client code</dt>
            <dd>{{ c.clientCode }}</dd>
          </div>
          <div>
            <dt>Organisation type</dt>
            <dd>{{ c.organisationTypeLabel }}</dd>
          </div>
          <div>
            <dt>CIN / FRN</dt>
            <dd>{{ c.cinFrn || '—' }}</dd>
          </div>
          <div>
            <dt>Date of incorporation / formation</dt>
            <dd>{{ date(c.incorporationDate) || '—' }}</dd>
          </div>
          <div>
            <dt>PAN</dt>
            <dd>{{ c.pan }}</dd>
          </div>
          <div>
            <dt>GSTIN</dt>
            <dd>{{ c.gstin || '—' }}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{{ c.email || '—' }}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{{ c.phone || '—' }}</dd>
          </div>
          <div class="wide">
            <dt>Address</dt>
            <dd>{{ c.address }}{{ c.city ? ', ' + c.city : '' }}</dd>
          </div>
          <div>
            <dt>Previous auditor</dt>
            <dd>{{ c.previousAuditor || '—' }}</dd>
          </div>
          <div>
            <dt>Assigned team</dt>
            <dd>{{ c.team.join(', ') || '—' }}</dd>
          </div>
          <div>
            <dt>Recurring work</dt>
            <dd>
              @for (rule of c.recurring; track rule.workTypeKey + rule.frequency) {
                <span class="chip">{{ rule.workTypeKey }} · {{ rule.frequency }}</span>
              } @empty {
                —
              }
            </dd>
          </div>
        </dl>
      </mat-card>

      <mat-card appearance="outlined" class="card">
        <h2>Directors / partners</h2>
        <div class="table-wrap">
          <table class="plain">
            <thead>
              <tr>
                <th>Name</th>
                <th>DIN</th>
                <th>Phone</th>
                <th>Email</th>
                <th>KYC</th>
              </tr>
            </thead>
            <tbody>
              @for (d of c.directors; track d.id) {
                <tr>
                  <td>{{ d.name }}</td>
                  <td>{{ d.din || '—' }}</td>
                  <td>{{ d.phone || '—' }}</td>
                  <td>{{ d.email || '—' }}</td>
                  <td>
                    <span class="kyc" [class.kyc--done]="d.kycStatus === 'done'">{{
                      d.kycStatus === 'done' ? 'Done' : 'Pending'
                    }}</span>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5">None added.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </mat-card>

      <mat-card appearance="outlined" class="card">
        <h2>Applicable laws</h2>
        <div>
          @for (law of c.lawKeys; track law) {
            <span class="chip">{{ law }}</span>
          } @empty {
            <span>None selected.</span>
          }
        </div>
      </mat-card>

      <app-credentials-card
        [clientId]="c.id"
        [credentialsSet]="c.credentialsSet"
        (changed)="reload()"
      />
    } @else if (error(); as message) {
      <p class="banner" role="alert"><mat-icon>error</mat-icon> {{ message }}</p>
      <a mat-stroked-button routerLink="/masters/clients">
        <mat-icon>arrow_back</mat-icon> All clients
      </a>
    } @else {
      <p class="banner" role="status">Loading…</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .card {
      padding: 1rem 1.25rem;
    }
    h2 {
      margin: 0 0 0.75rem;
      font: var(--mat-sys-title-medium);
    }
    .banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      padding: 0.6rem 1rem;
      border-radius: 12px;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .facts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      gap: 0.75rem 1.5rem;
      margin: 0;
    }
    .facts .wide {
      grid-column: 1 / -1;
    }
    dt {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .table-wrap {
      overflow-x: auto;
    }
    .plain {
      width: 100%;
      border-collapse: collapse;
    }
    .plain th,
    .plain td {
      padding: 0.4rem 0.6rem;
      text-align: left;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      white-space: nowrap;
    }
    .plain th {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }
    .chip,
    .kyc {
      display: inline-block;
      margin: 0 0.35rem 0.25rem 0;
      padding: 0 0.6rem;
      border-radius: 999px;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font: var(--mat-sys-label-medium);
      line-height: 1.6rem;
    }
    .kyc {
      margin: 0;
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    .kyc--done {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientDetailPage {
  readonly id = input.required<string>();

  private readonly repo = inject(ClientRepository);
  private readonly snackBar = inject(MatSnackBar);
  private readonly locale = inject(AppConfigService).config.locale.locale;
  private readonly session = inject(SessionService);

  protected readonly canEdit = this.session.can('clients.edit');
  protected readonly canDeactivate = this.session.can('clients.deactivate');
  protected readonly client = signal<Client | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // Reload when the route points at another client.
    effect(() => {
      this.id();
      untracked(() => this.reload());
    });
  }

  protected reload(): void {
    this.error.set(null);
    this.repo.get(this.id()).subscribe({
      next: (c) => this.client.set(c),
      // 404 (no such client, or outside your branches), 403 or a server error: say so.
      error: (e: unknown) => {
        this.client.set(null);
        this.error.set(toApiError(e).message);
      },
    });
  }

  protected date(iso: string): string {
    return formatDate(iso, this.locale);
  }

  protected toggleActive(client: Client): void {
    this.repo.setActive(client.id, !client.active).subscribe({
      next: () => {
        this.snackBar.open(client.active ? 'Client deactivated' : 'Client reactivated', 'OK', {
          duration: 2500,
        });
        this.reload();
      },
      error: (e: unknown) => this.snackBar.open(toApiError(e).message, 'OK', { duration: 6000 }),
    });
  }
}
