import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Sparkline } from '../sparkline/sparkline';

export type KpiTone = 'green' | 'blue' | 'amber' | 'red' | 'violet';

/** KPI tile: coloured icon, label, big value, optional hint and sparkline. */
@Component({
  selector: 'app-kpi-card',
  imports: [MatIconModule, Sparkline],
  template: `
    <div class="kpi__icon">
      <mat-icon>{{ icon() }}</mat-icon>
    </div>
    <div class="kpi__body">
      <div class="kpi__label">{{ label() }}</div>
      <div class="kpi__value">{{ value() }}</div>
      @if (hint()) {
        <div class="kpi__hint">{{ hint() }}</div>
      }
    </div>
    @if (trend().length > 1) {
      <app-sparkline class="kpi__spark" [values]="trend()" />
    }
  `,
  styleUrl: './kpi-card.scss',
  host: { '[class]': '"kpi kpi--" + tone() + (featured() ? " kpi--featured" : "")' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiCard {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly icon = input('insights');
  readonly hint = input('');
  readonly tone = input<KpiTone>('green');
  readonly trend = input<number[]>([]);
  /** Dark-green gradient card with light text; used for the first card of a row. */
  readonly featured = input(false);
}
