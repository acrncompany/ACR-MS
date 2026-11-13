import { Injectable, inject } from '@angular/core';
import { SessionService } from '../auth/session.service';
import { DirectoryStore } from './directory.store';

/**
 * Hierarchy visibility for mock repositories: a user sees their own records and those of
 * everyone who reports to them; roles flagged `seesAll` (Board) see everything.
 * UX only: a real backend must enforce these rules itself.
 */
@Injectable({ providedIn: 'root' })
export class ScopeService {
  private readonly session = inject(SessionService);
  private readonly directory = inject(DirectoryStore);

  /** Filters rows by the user id that owns each row. */
  filter<T>(rows: T[], ownerOf: (row: T) => string | null | undefined): T[] {
    const user = this.session.user();
    if (!user) return [];
    if (user.seesAll) return rows;
    const visible = this.directory.subtreeUserIds(user.id);
    return rows.filter((row) => {
      const owner = ownerOf(row);
      return !!owner && visible.has(owner);
    });
  }

  currentUserId(): string | null {
    return this.session.user()?.id ?? null;
  }

  /** True when the signed-in user has at least one person reporting to them. */
  hasReports(): boolean {
    const user = this.session.user();
    return !!user && (user.seesAll || this.directory.subtreeUserIds(user.id).size > 1);
  }
}
