import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';
import { SessionService } from '../../../core/auth/session.service';
import { AppConfigService } from '../../../core/config/app-config.service';
import { appGridTheme, numberColumn, textColumn } from '../../../shared/ag-grid';
import { KpiCard } from '../../../shared/components/kpi-card/kpi-card';
import { formatMoney } from '../../../shared/utils/money';
import { DepartmentRow, Kpi, Overview } from '../domain/dashboard.models';
import { DashboardRepository } from '../domain/dashboard.repository';
import { WorksheetInbox } from '../../worksheets/presentation/worksheet-inbox';
import { WorksheetWidgets } from '../../worksheets/presentation/worksheet-widgets';

@Component({
  selector: 'app-dashboard-page',
  imports: [AgGridAngular, KpiCard, MatCardModule, WorksheetInbox, WorksheetWidgets],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly cfg = inject(AppConfigService).config.locale;
  private readonly session = inject(SessionService);
  private readonly user = this.session.user;
  protected readonly showWorksheets = this.session.can('worksheet.view');

  protected readonly data = signal<Overview | null>(null);
  protected readonly gridTheme = appGridTheme;

  /** Sections follow the role's permissions (UX only; the backend scopes the data). */
  protected readonly can = {
    departments: this.session.can('hr.view') || !!this.user()?.seesAll,
  };

  /** KPI id -> permissions that make it relevant to the signed-in role. */
  private readonly kpiAccess: Record<string, string[]> = {
    clients: ['clients.view'],
    staff: ['hr.view'],
  };

  protected readonly kpis = computed(() =>
    (this.data()?.kpis ?? []).filter((k) =>
      (this.kpiAccess[k.id] ?? []).some((p) => this.session.can(p)),
    ),
  );

  constructor() {
    inject(DashboardRepository)
      .overview()
      .subscribe((overview) => this.data.set(overview));
  }

  protected display(kpi: Kpi): string {
    if (kpi.kind === 'money') return formatMoney(kpi.value, this.cfg.locale, this.cfg.currency);
    if (kpi.kind === 'percent') return `${kpi.value}%`;
    return new Intl.NumberFormat(this.cfg.locale).format(kpi.value);
  }

  protected readonly departmentColumns: ColDef<DepartmentRow>[] = [
    { ...textColumn<DepartmentRow>('department', 'Department', 2), minWidth: 160 },
    textColumn<DepartmentRow>('head', 'Lead'),
    numberColumn<DepartmentRow>('headcount', 'People'),
  ];
}
