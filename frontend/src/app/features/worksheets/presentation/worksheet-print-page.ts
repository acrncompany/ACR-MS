import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AppConfigService } from '../../../core/config/app-config.service';
import { formatDate, formatDateTime } from '../../../shared/utils/date';
import { formatMoney } from '../../../shared/utils/money';
import { Stamp } from '../domain/worksheet.models';
import { WorksheetRepository } from '../domain/worksheet.repository';
import { WorksheetContext } from './worksheet.context';

/**
 * Printable layout modelled on the paper "Work / Compliance Sheet", for the transition period.
 * Client portal credentials are deliberately never printed.
 */
@Component({
  selector: 'app-worksheet-print-page',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './worksheet-print-page.html',
  styleUrl: './worksheet-print-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorksheetPrintPage {
  readonly id = input.required<string>();

  protected readonly ctx = inject(WorksheetContext);
  private readonly repo = inject(WorksheetRepository);
  private readonly cfg = inject(AppConfigService).config;

  protected readonly sheet = computed(() => this.repo.sheets().find((s) => s.id === this.id()));
  protected readonly client = computed(() =>
    this.ctx.clients().find((c) => c.id === this.sheet()?.clientId),
  );
  protected readonly firm = this.cfg.branding.productName;
  /** At least three lines, like the paper form, more when there are more items. */
  protected readonly docRows = computed(() => {
    const s = this.sheet();
    const count = Math.max(3, s?.documents.length ?? 0, s?.returned.length ?? 0);
    return Array.from({ length: count }, (_, i) => i);
  });

  protected name(id: string | null): string {
    return this.repo.nameOf(id);
  }

  protected date(iso: string | null | undefined): string {
    return formatDate(iso, this.cfg.locale.locale);
  }

  protected money(value: number | null): string {
    return value === null
      ? ''
      : formatMoney(value, this.cfg.locale.locale, this.cfg.locale.currency);
  }

  protected stamp(stamp: Stamp | null): string {
    return stamp
      ? `${stamp.name} (${stamp.role}) ${formatDateTime(stamp.at, this.cfg.locale.locale)}`
      : '';
  }

  protected time(iso: string): string {
    return formatDateTime(iso, this.cfg.locale.locale);
  }

  protected print(): void {
    window.print();
  }
}
