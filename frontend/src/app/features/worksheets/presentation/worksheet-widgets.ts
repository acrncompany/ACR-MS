import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { ThemeService } from '../../../core/theme/theme.service';
import { readChartColors } from '../../../shared/chart-colors';
import { Chart, ChartOption } from '../../../shared/components/chart/chart';
import { KpiCard } from '../../../shared/components/kpi-card/kpi-card';
import { WorksheetRepository } from '../domain/worksheet.repository';
import { WorksheetContext } from './worksheet.context';

/** Work sheet numbers for whoever is signed in (the rows are already hierarchy-scoped). */
@Component({
  selector: 'app-worksheet-widgets',
  imports: [Chart, KpiCard, MatCardModule],
  template: `
    <section class="kpis" aria-label="Work sheet figures">
      <app-kpi-card
        [featured]="true"
        label="Waiting for me"
        icon="inbox"
        [value]="'' + waiting()"
        hint="Sheets where I have an action"
      />
      <app-kpi-card label="Overdue" icon="warning" tone="red" [value]="'' + overdue()" />
      <app-kpi-card label="Due this week" icon="event" tone="amber" [value]="'' + dueThisWeek()" />
      <app-kpi-card
        label="Completed this month"
        icon="task_alt"
        tone="blue"
        [value]="'' + completed()"
      />
    </section>

    <section class="charts">
      <mat-card appearance="outlined" class="panel">
        <h2>Pending by stage</h2>
        <app-chart [option]="stageOption()" height="16rem" />
      </mat-card>
      <mat-card appearance="outlined" class="panel">
        <h2>Workload per team member</h2>
        @if (hasWorkload()) {
          <app-chart [option]="workloadOption()" height="16rem" />
        } @else {
          <p class="empty">No work is allocated to a team member yet.</p>
        }
      </mat-card>
    </section>
  `,
  styles: `
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .charts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr));
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .panel {
      padding: 1rem 1.25rem;
    }
    h2 {
      margin: 0 0 0.5rem;
      font: var(--mat-sys-title-medium);
    }
    .empty {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorksheetWidgets {
  private readonly ctx = inject(WorksheetContext);
  private readonly repo = inject(WorksheetRepository);
  private readonly theme = inject(ThemeService);

  private readonly rows = this.ctx.rows;
  protected readonly waiting = computed(() => this.rows().filter((r) => r.waiting).length);
  protected readonly overdue = computed(() => this.rows().filter((r) => r.overdue).length);
  protected readonly dueThisWeek = computed(
    () =>
      this.rows().filter(
        (r) =>
          !r.closed && !!r.target && r.target >= this.ctx.today && r.target <= this.ctx.weekEnd,
      ).length,
  );
  protected readonly completed = computed(
    () =>
      this.rows().filter((r) => r.closed && r.sheet.closedAt.startsWith(this.ctx.monthPrefix))
        .length,
  );

  private readonly workload = computed(() => {
    const byMember = new Map<string, { open: number; overdue: number }>();
    for (const row of this.rows()) {
      if (row.closed || !row.sheet.assignedTmId) continue;
      const entry = byMember.get(row.tmName) ?? { open: 0, overdue: 0 };
      if (row.overdue) entry.overdue += 1;
      else entry.open += 1;
      byMember.set(row.tmName, entry);
    }
    return [...byMember.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  });
  protected readonly hasWorkload = computed(() => this.workload().length > 0);

  protected readonly stageOption = computed<ChartOption>(() => {
    this.theme.mode(); // rebuild with the current theme's colours
    const c = readChartColors();
    const stages = this.repo.workflow().stages.filter((s) => !s.terminal);
    const rows = this.rows();
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: stages.map((s) => s.label),
        axisLabel: { color: c.muted, interval: 0, rotate: 30 },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: c.muted },
        splitLine: { lineStyle: { color: c.grid } },
      },
      series: [
        {
          name: 'Sheets',
          type: 'bar',
          barMaxWidth: 28,
          data: stages.map((s) => rows.filter((r) => r.stageKey === s.key).length),
          itemStyle: { color: c.primary, borderRadius: [6, 6, 0, 0] },
        },
      ],
    };
  });

  protected readonly workloadOption = computed<ChartOption>(() => {
    this.theme.mode();
    const c = readChartColors();
    const members = this.workload();
    const series = (name: string, key: 'open' | 'overdue', color: string) => ({
      name,
      type: 'bar',
      stack: 'work',
      barMaxWidth: 26,
      data: members.map(([, v]) => v[key]),
      itemStyle: { color },
    });
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { bottom: 0, textStyle: { color: c.muted } },
      grid: { left: 8, right: 8, top: 16, bottom: 36, containLabel: true },
      xAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: c.muted },
        splitLine: { lineStyle: { color: c.grid } },
      },
      yAxis: {
        type: 'category',
        data: members.map(([name]) => name),
        axisLabel: { color: c.muted },
      },
      series: [series('On time', 'open', c.primary), series('Overdue', 'overdue', c.danger)],
    };
  });
}
