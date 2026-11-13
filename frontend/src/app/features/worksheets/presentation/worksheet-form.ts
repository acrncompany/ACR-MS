import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { formatDateTime } from '../../../shared/utils/date';
import { Client } from '../../clients/domain/client.models';
import { CredentialsCard } from '../../clients/presentation/credentials-card';
import { Stamp, WorkSheet, WorkType } from '../domain/worksheet.models';
import { SectionKey, WorkflowConfig } from '../domain/workflow.models';
import { WsNumber, WsOption, WsSelect, WsText } from './ws-fields';

/**
 * All sections of the sheet as cards. `draft` is the working copy the form edits; `sheet` is
 * the stored version (assignment, stamps and approval always show the stored values). Only the
 * sections in `editable` accept input; the rest are read-only.
 */
@Component({
  selector: 'app-worksheet-form',
  imports: [
    CredentialsCard,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatIconModule,
    WsNumber,
    WsSelect,
    WsText,
  ],
  templateUrl: './worksheet-form.html',
  styleUrl: './worksheet-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorksheetForm {
  readonly draft = input.required<WorkSheet>();
  readonly sheet = input.required<WorkSheet>();
  readonly editable = input.required<Set<SectionKey>>();
  readonly clients = input.required<Client[]>();
  readonly workTypes = input.required<WorkType[]>();
  readonly workflow = input.required<WorkflowConfig>();
  readonly locale = input.required<string>();
  readonly names = input.required<(id: string | null) => string>();
  /** Emits the credential field label after a reveal (the sheet logs it in its history). */
  readonly credentialRevealed = output<string>();

  protected readonly clientOptions = computed<WsOption[]>(() =>
    this.clients().map((c) => ({ value: c.id, label: c.name })),
  );
  protected readonly typeOptions = computed<WsOption[]>(() =>
    this.workTypes().map((t) => ({ value: t.key, label: t.label })),
  );
  protected readonly client = computed(() =>
    this.clients().find((c) => c.id === this.draft().clientId),
  );
  protected readonly deliveryModes = computed(() =>
    this.options(this.workflow().lists.deliveryModes),
  );
  protected readonly paymentModes = computed(() =>
    this.options(this.workflow().lists.paymentModes),
  );
  protected readonly verifyModes = computed(() => this.options(this.workflow().lists.verifyModes));
  protected readonly yesNo: WsOption[] = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
  ];
  protected readonly taxKinds: WsOption[] = [
    { value: 'payable', label: 'Tax payable' },
    { value: 'refund', label: 'Refund' },
  ];

  protected ro(section: SectionKey): boolean {
    return !this.editable().has(section);
  }

  protected active(section: SectionKey): boolean {
    return this.editable().has(section);
  }

  private options(values: string[]): WsOption[] {
    return values.map((v) => ({ value: v, label: v }));
  }

  protected stamp(stamp: Stamp | null): string {
    return stamp
      ? `${stamp.name} · ${stamp.role} · ${formatDateTime(stamp.at, this.locale())}`
      : '';
  }

  protected decisionTone(decision: string): string {
    return decision === 'OK' ? 'ok' : decision === 'Rework' ? 'warn' : 'bad';
  }

  // ---- list editing (the draft is a plain mutable copy; the card re-renders on events)
  protected addContact(): void {
    this.draft().contacts.push({ name: '', phone: '', email: '' });
  }
  protected addRequirement(): void {
    this.draft().requirements.push('');
  }
  protected addBill(): void {
    this.draft().pendingBills.push({ ref: '', amount: null });
  }
  protected addDocument(): void {
    this.draft().documents.push({ name: '', receivedOn: '' });
  }
  protected addReturned(): void {
    this.draft().returned.push({ name: '', returnedOn: '' });
  }
  protected addFolder(): void {
    this.draft().completion.folderLocations.push('');
  }
  protected remove(list: unknown[], index: number): void {
    list.splice(index, 1);
  }
  protected setItem(list: string[], index: number, value: string): void {
    list[index] = value;
  }
  protected setLocation(index: number, value: string): void {
    this.draft().completion.folderLocations[index] = value;
  }
}
