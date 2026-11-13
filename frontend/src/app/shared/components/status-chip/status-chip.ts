import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { statusTone } from '../../utils/status';

/** Coloured status pill (pending, in progress, completed, overdue, ...). */
@Component({
  selector: 'app-status-chip',
  template: '{{ status() }}',
  host: { '[class]': '"status status--" + tone()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusChip {
  readonly status = input.required<string>();
  protected readonly tone = computed(() => statusTone(this.status()));
}
