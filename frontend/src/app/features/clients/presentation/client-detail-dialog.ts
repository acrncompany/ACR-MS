import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { Client } from '../domain/client.models';
import { CredentialsCard } from './credentials-card';

export interface ClientDetailData {
  client: Client;
  /** Called after a credential changed, so the list can refresh. */
  onChanged: () => void;
}

/** Client master record: profile, principals, recurring work and portal credentials. */
@Component({
  selector: 'app-client-detail-dialog',
  imports: [CredentialsCard, MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ data.client.name }}</h2>
    <mat-dialog-content>
      <dl class="facts">
        <div>
          <dt>Constitution</dt>
          <dd>{{ data.client.constitution }}</dd>
        </div>
        <div>
          <dt>PAN</dt>
          <dd>{{ data.client.pan }}</dd>
        </div>
        <div>
          <dt>GSTIN</dt>
          <dd>{{ data.client.gstin || '—' }}</dd>
        </div>
        <div class="wide">
          <dt>Address</dt>
          <dd>{{ data.client.address }}</dd>
        </div>
        <div>
          <dt>Previous auditor</dt>
          <dd>{{ data.client.previousAuditor || '—' }}</dd>
        </div>
        <div>
          <dt>Recurring work</dt>
          <dd>
            @for (rule of data.client.recurring; track rule.workTypeKey + rule.frequency) {
              <span class="chip">{{ rule.workTypeKey }} · {{ rule.frequency }}</span>
            } @empty {
              —
            }
          </dd>
        </div>
      </dl>

      <h3>Proprietor / partners / directors</h3>
      <ul class="principals">
        @for (p of data.client.principals; track p.name) {
          <li>
            <strong>{{ p.name }}</strong> · {{ p.designation }} · {{ p.mobile }}
          </li>
        }
      </ul>

      <app-credentials-card
        [clientId]="data.client.id"
        [credentialsSet]="credentialsSet()"
        (changed)="changed()"
      />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    .facts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      gap: 0.75rem 1.5rem;
      margin: 0 0 1rem;
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
    }
    h3 {
      margin: 0.5rem 0;
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-primary);
    }
    .principals {
      margin: 0 0 1rem;
      padding-left: 1.1rem;
    }
    .chip {
      display: inline-block;
      margin-right: 0.35rem;
      padding: 0 0.6rem;
      border-radius: 999px;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font: var(--mat-sys-label-medium);
      line-height: 1.6rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientDetailDialog {
  protected readonly data = inject<ClientDetailData>(MAT_DIALOG_DATA);
  protected readonly credentialsSet = signal(this.data.client.credentialsSet);

  protected changed(): void {
    this.data.onChanged();
  }
}
