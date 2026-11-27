import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs';
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
  imports: [FilterSearch, KpiCard, NgTemplateOutlet, PageHeader, PagedGrid],
  templateUrl: './data-page.html',
  styleUrl: './data-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataPage {
  readonly title = input('');
  readonly summary = input<SummaryItem[]>([]);
  readonly columns = input.required<ColDef[]>();
  readonly rows = input.required<unknown[]>();
  readonly searchPlaceholder = input('Search');
  /** Emits the row's data when a row is clicked (the page decides what to open). */
  readonly rowClick = output<unknown>();

  /**
   * Server mode: `rows` is the current page from the server, `total` the number of matches. The
   * search box (debounced) and the pager emit `queryChange`; the parent loads the data.
   */
  readonly serverSide = input(false);
  readonly total = input(0);
  readonly page = input(1);
  readonly pageSize = input(25);
  readonly loading = input(false);
  /** An error message to show instead of the grid's empty text. */
  readonly errorMessage = input<string | null>(null);
  readonly queryChange = output<{ search: string; page: number; pageSize: number }>();

  protected readonly search = signal('');
  protected readonly matching = signal(0);

  constructor() {
    toObservable(this.search)
      .pipe(
        skip(1),
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((search) => {
        if (this.serverSide())
          this.queryChange.emit({ search, page: 1, pageSize: this.pageSize() });
      });
  }

  protected onPage(request: { page: number; pageSize: number }): void {
    this.queryChange.emit({ search: this.search(), ...request });
  }
}
