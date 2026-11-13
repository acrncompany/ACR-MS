import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { formatDate, formatDateTime } from '../../../shared/utils/date';
import { HistoryEntry, HistoryKind } from '../domain/worksheet.models';

const ICONS: Record<HistoryKind, string> = {
  create: 'add_circle',
  edit: 'edit',
  action: 'check_circle',
  reassign: 'swap_horiz',
  retarget: 'event',
  credential: 'key',
};

/** Immutable history of the sheet: every action with who, when, comments and changes. */
@Component({
  selector: 'app-timeline-panel',
  imports: [MatCardModule, MatIconModule],
  template: `
    <mat-card appearance="outlined" class="panel">
      <h2><mat-icon>history</mat-icon> Timeline</h2>
      <ol>
        @for (entry of entries(); track entry.id) {
          <li [class]="'entry entry--' + entry.kind">
            <mat-icon class="dot">{{ icon(entry.kind) }}</mat-icon>
            <div class="body">
              <strong>{{ entry.label }}</strong>
              @if (entry.fromStage && entry.toStage && entry.fromStage !== entry.toStage) {
                <span class="move"
                  >{{ stageName(entry.fromStage) }} → {{ stageName(entry.toStage) }}</span
                >
              }
              <span class="who">
                {{ entry.userName }} · {{ entry.role }} · {{ at(entry.at) }}
              </span>
              @for (change of entry.changes; track change.label) {
                <span class="change"
                  >{{ change.label }}: {{ value(change.from) }} → {{ value(change.to) }}</span
                >
              }
              @if (entry.comment) {
                <span class="comment">“{{ entry.comment }}”</span>
              }
            </div>
          </li>
        }
      </ol>
    </mat-card>
  `,
  styles: `
    .panel {
      padding: 1rem 1.25rem;
    }
    h2 {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin: 0 0 0.75rem;
      font: var(--mat-sys-title-medium);
    }
    ol {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .entry {
      display: flex;
      gap: 0.6rem;
      padding: 0.55rem 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .dot {
      flex: none;
      color: var(--mat-sys-primary);
    }
    .entry--reassign .dot,
    .entry--retarget .dot {
      color: var(--mat-sys-tertiary);
    }
    .entry--credential .dot,
    .entry--edit .dot {
      color: var(--mat-sys-on-surface-variant);
    }
    .body {
      display: grid;
      gap: 0.1rem;
      min-width: 0;
    }
    .move,
    .who,
    .change {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .comment {
      font-style: italic;
      overflow-wrap: anywhere;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelinePanel {
  readonly history = input.required<HistoryEntry[]>();
  readonly locale = input.required<string>();
  readonly stageLabel = input.required<(key: string) => string>();

  protected readonly entries = computed(() => [...this.history()].reverse());

  protected icon(kind: HistoryKind): string {
    return ICONS[kind];
  }

  protected stageName(key: string): string {
    return this.stageLabel()(key);
  }

  /** Dates are stored as ISO strings; show them in the configured locale. */
  protected value(text: string): string {
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? formatDate(text, this.locale()) : text;
  }

  protected at(iso: string): string {
    return formatDateTime(iso, this.locale());
  }
}
