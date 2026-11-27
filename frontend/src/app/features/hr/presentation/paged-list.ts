import { computed, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { toApiError } from '../../../core/http/api-error';
import { Page, PageQuery } from '../../../core/http/page';

/**
 * State of one server-side list (search, paging, loading, error) for the HR directory pages.
 * Search and paging happen on the server; `reload()` re-runs the current query.
 */
export class PagedList<T> {
  readonly items = signal<T[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(25);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly rows = computed(() => this.items());
  private search = '';

  constructor(private readonly fetch: (query: PageQuery) => Observable<Page<T>>) {
    this.reload();
  }

  onQuery(query: { search: string; page: number; pageSize: number }): void {
    this.search = query.search;
    this.page.set(query.page);
    this.pageSize.set(query.pageSize);
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.fetch({ q: this.search, page: this.page(), pageSize: this.pageSize() }).subscribe({
      next: (result) => {
        this.items.set(result.items);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.items.set([]);
        this.total.set(0);
        this.loading.set(false);
        this.error.set(toApiError(e).message);
      },
    });
  }
}
