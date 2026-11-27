import { Signal, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { toApiError } from '../../core/http/api-error';

/** Loads a list from a repository into a signal; call `reload()` after a change. */
export function loaded<T>(source: () => Observable<T[]>): {
  rows: Signal<T[]>;
  reload: () => void;
} {
  const rows = signal<T[]>([]);
  const reload = (): void => {
    // A failed load (403, offline, ended session) leaves the list empty instead of throwing.
    source().subscribe({ next: (list) => rows.set(list), error: () => rows.set([]) });
  };
  reload();
  return { rows: rows.asReadonly(), reload };
}

export interface LoadedState<T> {
  rows: T[];
  loading: boolean;
  /** A readable message when the last load failed (403, network, server error). */
  error: string | null;
}

/**
 * Like `loaded`, but also tracks loading and a readable error, so a page can show a loading
 * line, an empty state and a clear error (403, 5xx, offline) instead of a silent blank list.
 */
export function loadedState<T>(source: () => Observable<T[]>): {
  state: Signal<LoadedState<T>>;
  reload: () => void;
} {
  const state = signal<LoadedState<T>>({ rows: [], loading: true, error: null });
  const reload = (): void => {
    state.update((s) => ({ ...s, loading: true, error: null }));
    source().subscribe({
      next: (rows) => state.set({ rows, loading: false, error: null }),
      error: (e: unknown) => state.set({ rows: [], loading: false, error: toApiError(e).message }),
    });
  };
  reload();
  return { state: state.asReadonly(), reload };
}
