import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { ColDef } from 'ag-grid-community';
import { FilterSearch } from '../filter-select/filter-search';
import { KpiCard, KpiTone } from '../kpi-card/kpi-card';
import { PageHeader } from '../page-header/page-header';
import { PagedGrid } from '../paged-grid/paged-grid';

export interface SummaryItem {
  label: string;
  value: string;
  icon?: string;
  tone?: KpiTone;
  hint?: string;
}

/**
 * Standard list page: fixed header and summary cards, then a toolbar and a paged grid that
 * scrolls vertically on its own. The page itself never scrolls.
 */
@Component({
  selector: 'app-data-page',
  imports: [FilterSearch, KpiCard, PageHeader, PagedGrid],
  templateUrl: './data-page.html',
  styleUrl: './data-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataPage {
  readonly title = input.required<string>();
  readonly summary = input<SummaryItem[]>([]);
  readonly columns = input.required<ColDef[]>();
  readonly rows = input.required<unknown[]>();
  /** Emits the row's data when a row is clicked (the page decides what to open). */
  readonly rowClick = output<unknown>();

  protected readonly search = signal('');
  protected readonly matching = signal(0);
}
