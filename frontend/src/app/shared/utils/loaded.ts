import { Signal, signal } from '@angular/core';
import { Observable } from 'rxjs';

/** Loads a list from a repository into a signal; call `reload()` after a change. */
export function loaded<T>(source: () => Observable<T[]>): {
  rows: Signal<T[]>;
  reload: () => void;
} {
  const rows = signal<T[]>([]);
  const reload = (): void => {
    source().subscribe((list) => rows.set(list));
  };
  reload();
  return { rows: rows.asReadonly(), reload };
}
