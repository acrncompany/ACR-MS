import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GetRowIdFunc, GridApi, GridReadyEvent, RowClassParams } from 'ag-grid-community';
import { appGridTheme } from '../../ag-grid';

/** Most columns a listing shows, so it never needs a horizontal scrollbar. */
const MAX_COLUMNS = 5;
const ALL = 0;

/**
 * The standard listing: an AG Grid that fills its parent and scrolls vertically on its own,
 * with a pager (page size 10/25/50/100/All) underneath. Give the host a bounded height
 * (a flex child with `min-height: 0`).
 */
@Component({
  selector: 'app-paged-grid',
  imports: [AgGridAngular, MatIconModule],
  templateUrl: './paged-grid.html',
  styleUrl: './paged-grid.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagedGrid {
  readonly rows = input.required<unknown[]>();
  readonly columns = input.required<ColDef[]>();
  readonly quickFilter = input('');
  readonly getRowId = input<GetRowIdFunc>();
  readonly getRowClass = input<(params: RowClassParams) => string | undefined>();
  readonly rowClick = output<unknown>();
  /** Rows left after the quick filter, for the page's own counter. */
  readonly matchingChange = output<number>();

  /**
   * Server mode: `rows` is ONE page the server returned; the grid neither filters nor paginates
   * by itself. The pager shows `total` and asks the parent for another page (`pageRequest`).
   */
  readonly serverMode = input(false);
  readonly total = input(0);
  /** 1-based page currently shown (server mode). */
  readonly serverPage = input(1);
  readonly serverPageSize = input(25);
  readonly pageRequest = output<{ page: number; pageSize: number }>();

  protected readonly theme = appGridTheme;
  protected readonly defaultColDef: ColDef = { sortable: true, resizable: true };
  protected readonly clientSizes = [10, 25, 50, 100, ALL];
  protected readonly serverSizes = [10, 25, 50, 100];
  protected readonly sizes = computed(() =>
    this.serverMode() ? this.serverSizes : this.clientSizes,
  );
  protected readonly ALL = ALL;
  protected readonly size = signal(25);
  protected readonly page = signal(0);
  protected readonly pageCount = signal(1);
  protected readonly matching = signal(0);
  private api?: GridApi;

  /** At most five columns; action columns (no `field`) keep their place over the last data ones. */
  protected readonly visibleColumns = computed<ColDef[]>(() => {
    const all = this.columns();
    if (all.length <= MAX_COLUMNS) return all;
    const actions = all.filter((c) => !c.field);
    const keep = new Set<ColDef>([
      ...all.filter((c) => c.field).slice(0, MAX_COLUMNS - actions.length),
      ...actions,
    ]);
    return all.filter((c) => keep.has(c));
  });

  /** "All" is one page holding every row. */
  protected readonly pageSize = computed(() =>
    this.serverMode()
      ? this.serverPageSize()
      : this.size() === ALL
        ? Math.max(this.rows().length, 1)
        : this.size(),
  );
  // What the pager shows: the grid's own numbers, or the server's.
  protected readonly shownSize = computed(() =>
    this.serverMode() ? this.serverPageSize() : this.size(),
  );
  protected readonly shownPage = computed(() =>
    this.serverMode() ? this.serverPage() - 1 : this.page(),
  );
  protected readonly shownPageCount = computed(() =>
    this.serverMode()
      ? Math.max(Math.ceil(this.total() / this.serverPageSize()), 1)
      : this.pageCount(),
  );
  protected readonly shownMatching = computed(() =>
    this.serverMode() ? this.total() : this.matching(),
  );
  protected readonly from = computed(() =>
    this.shownMatching() ? this.shownPage() * this.pageSize() + 1 : 0,
  );
  protected readonly to = computed(() =>
    Math.min((this.shownPage() + 1) * this.pageSize(), this.shownMatching()),
  );

  /** First, last and a window around the current page; null is an ellipsis. */
  protected readonly pages = computed<(number | null)[]>(() => {
    const last = this.shownPageCount() - 1;
    const current = this.shownPage();
    const keep = [0, last, current - 1, current, current + 1].filter((n) => n >= 0 && n <= last);
    const out: (number | null)[] = [];
    let prev = -1;
    for (const n of [...new Set(keep)].sort((a, b) => a - b)) {
      if (n - prev > 1) out.push(null);
      out.push(n);
      prev = n;
    }
    return out;
  });

  protected onReady(event: GridReadyEvent): void {
    this.api = event.api;
    this.sync();
  }

  protected sync(): void {
    if (!this.api) return;
    this.page.set(this.api.paginationGetCurrentPage());
    this.pageCount.set(Math.max(this.api.paginationGetTotalPages(), 1));
    const matching = this.api.paginationGetRowCount();
    if (matching !== this.matching()) {
      this.matching.set(matching);
      this.matchingChange.emit(matching);
    }
  }

  protected goTo(page: number): void {
    if (this.serverMode()) {
      this.pageRequest.emit({ page: page + 1, pageSize: this.serverPageSize() });
      return;
    }
    this.api?.paginationGoToPage(page);
  }

  protected setSize(value: string): void {
    const size = Number(value);
    if (this.serverMode()) {
      this.pageRequest.emit({ page: 1, pageSize: size });
      return;
    }
    this.size.set(size);
  }
}
