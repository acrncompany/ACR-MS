import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SessionService } from '../../../core/auth/session.service';
import { AppConfigService } from '../../../core/config/app-config.service';
import { formatDateTime } from '../../../shared/utils/date';
import {
  CREDENTIAL_FIELDS,
  CredentialAuditEntry,
  CredentialField,
  CredentialKey,
} from '../domain/client.models';
import { ClientRepository } from '../domain/client.repository';

/** How long a revealed secret stays on screen before it is masked again. */
const REVEAL_SECONDS = 30;
const MASK = '••••••••••';

/**
 * Portal credentials of a CLIENT. Always masked; "Reveal" needs `worksheet.reveal` and every
 * reveal is audited by the repository. A secret is only held in memory while it is shown.
 */
@Component({
  selector: 'app-credentials-card',
  imports: [MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <mat-card appearance="outlined" class="card">
      <div class="head">
        <h2><mat-icon>key</mat-icon> Portal credentials</h2>
        <span class="note">
          Stored on the client, shared by every work sheet. Always masked.
          @if (!canReveal) {
            You do not have permission to reveal them.
          }
        </span>
      </div>

      @for (group of groups(); track group.name) {
        <h3>{{ group.name }}</h3>
        <ul class="rows">
          @for (field of group.fields; track field.key) {
            <li>
              <span class="label">{{ field.label }}</span>
              @if (editing() === field.key) {
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="edit">
                  <mat-label>New {{ field.label }}</mat-label>
                  <input
                    matInput
                    [type]="field.kind === 'date' ? 'date' : 'password'"
                    autocomplete="off"
                    #edit
                    [value]="newValue()"
                    (input)="newValue.set(edit.value)"
                  />
                </mat-form-field>
                <button mat-flat-button type="button" (click)="save(field)">Save</button>
                <button mat-button type="button" (click)="editing.set(null)">Cancel</button>
              } @else {
                <span
                  class="value"
                  [class.value--revealed]="revealed()[field.key] !== undefined"
                  [attr.aria-label]="field.label + (isSet(field.key) ? ' (masked)' : ' (not set)')"
                >
                  @if (!isSet(field.key)) {
                    <em>Not set</em>
                  } @else if (revealed()[field.key] !== undefined) {
                    {{ revealed()[field.key] }}
                  } @else {
                    {{ mask }}
                  }
                </span>
                @if (isSet(field.key) && canReveal) {
                  @if (revealed()[field.key] !== undefined) {
                    <button mat-button type="button" (click)="hide(field.key)">
                      <mat-icon>visibility_off</mat-icon> Hide
                    </button>
                  } @else {
                    <button mat-button type="button" (click)="reveal(field)">
                      <mat-icon>visibility</mat-icon> Reveal
                    </button>
                  }
                }
                @if (canEdit()) {
                  <button mat-button type="button" (click)="edit(field.key)">
                    <mat-icon>edit</mat-icon> {{ isSet(field.key) ? 'Change' : 'Set' }}
                  </button>
                }
              }
            </li>
          }
        </ul>
      }

      @if ((canReveal || canEdit()) && audit().length) {
        <h3>Access log</h3>
        <ul class="audit">
          @for (entry of audit().slice(0, 5); track entry.id) {
            <li>
              {{ entry.userName }} {{ entry.action }} {{ labelOf(entry.key) }} ·
              {{ at(entry.at) }}
            </li>
          }
        </ul>
      }
    </mat-card>
  `,
  styles: `
    .card {
      padding: 1rem 1.25rem;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.5rem;
    }
    h2 {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    h3 {
      margin: 1rem 0 0.25rem;
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-primary);
    }
    .note {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .rows,
    .audit {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .rows li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      min-height: 2.5rem;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .label {
      width: 8rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .value {
      flex: 1;
      min-width: 8rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      letter-spacing: 0.04em;
    }
    .value--revealed {
      color: var(--mat-sys-primary);
      font-weight: 600;
    }
    .edit {
      flex: 1;
      min-width: 12rem;
    }
    .audit li {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
      padding: 0.15rem 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredentialsCard {
  readonly clientId = input.required<string>();
  /** Fields that have a value on the client (from the client list; never the values). */
  readonly credentialsSet = input<CredentialKey[]>([]);
  /** Work sheet the secrets are being opened from, recorded in the audit trail. */
  readonly worksheetId = input<string | null>(null);
  /** Emits the field label after a successful reveal (the sheet logs it in its history). */
  readonly revealedField = output<string>();
  /** Emits after a secret was changed so the parent can refresh its client list. */
  readonly changed = output<void>();

  private readonly repo = inject(ClientRepository);
  private readonly session = inject(SessionService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly locale = inject(AppConfigService).config.locale.locale;

  protected readonly mask = MASK;
  protected readonly canReveal = this.session.can('worksheet.reveal');
  protected readonly canEdit = computed(() => this.session.can('clients.edit'));
  protected readonly revealed = signal<Partial<Record<CredentialKey, string>>>({});
  protected readonly editing = signal<CredentialKey | null>(null);
  protected readonly newValue = signal('');
  protected readonly audit = signal<CredentialAuditEntry[]>([]);
  private readonly setLocally = signal<Set<CredentialKey>>(new Set());
  private readonly timers = new Map<CredentialKey, ReturnType<typeof setTimeout>>();

  protected readonly groups = computed(() => {
    const names: CredentialField['group'][] = ['Income Tax', 'GST / KVAT', 'Others'];
    return names.map((name) => ({
      name,
      fields: CREDENTIAL_FIELDS.filter((f) => f.group === name),
    }));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearAll());
    // A different client means different secrets: forget anything revealed for the old one.
    effect(() => {
      this.clientId();
      // Only the client id may re-run this: the repository reads signals of its own.
      untracked(() => {
        this.clearAll();
        this.setLocally.set(new Set());
        this.loadAudit();
      });
    });
  }

  protected isSet(key: CredentialKey): boolean {
    return this.credentialsSet().includes(key) || this.setLocally().has(key);
  }

  protected labelOf(key: CredentialKey): string {
    const field = CREDENTIAL_FIELDS.find((f) => f.key === key);
    return field ? `${field.group} ${field.label}` : key;
  }

  protected at(iso: string): string {
    return formatDateTime(iso, this.locale);
  }

  protected reveal(field: CredentialField): void {
    this.repo.revealCredential(this.clientId(), field.key, this.worksheetId()).subscribe({
      next: (value) => {
        this.revealed.update((all) => ({ ...all, [field.key]: value }));
        this.clearTimer(field.key);
        this.timers.set(
          field.key,
          setTimeout(() => this.hide(field.key), REVEAL_SECONDS * 1000),
        );
        this.revealedField.emit(`${field.group} ${field.label}`);
        this.loadAudit();
      },
      error: (e: Error) => this.snackBar.open(e.message, 'OK', { duration: 5000 }),
    });
  }

  protected hide(key: CredentialKey): void {
    this.clearTimer(key);
    this.revealed.update((all) => {
      const next = { ...all };
      delete next[key];
      return next;
    });
  }

  protected edit(key: CredentialKey): void {
    this.newValue.set('');
    this.editing.set(key);
  }

  protected save(field: CredentialField): void {
    const value = this.newValue().trim();
    if (!value) return;
    this.repo.updateCredential(this.clientId(), field.key, value, this.worksheetId()).subscribe({
      next: () => {
        this.editing.set(null);
        this.newValue.set('');
        this.hide(field.key);
        this.setLocally.update((set) => new Set(set).add(field.key));
        this.snackBar.open(`${field.group} ${field.label} updated for all work sheets`, 'OK', {
          duration: 4000,
        });
        this.changed.emit();
        this.loadAudit();
      },
      error: (e: Error) => this.snackBar.open(e.message, 'OK', { duration: 5000 }),
    });
  }

  private loadAudit(): void {
    if (!this.canReveal && !this.canEdit()) return;
    this.repo.credentialAudit(this.clientId()).subscribe((list) => this.audit.set(list));
  }

  private clearTimer(key: CredentialKey): void {
    const timer = this.timers.get(key);
    if (timer) clearTimeout(timer);
    this.timers.delete(key);
  }

  private clearAll(): void {
    for (const key of [...this.timers.keys()]) this.clearTimer(key);
    this.revealed.set({});
    this.editing.set(null);
  }
}
