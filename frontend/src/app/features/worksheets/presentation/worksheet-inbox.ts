import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { SheetGrid } from './sheet-grid';
import { WorksheetContext } from './worksheet.context';

/** Sheets waiting for my action, and my team's sheets (shown on the dashboard). */
@Component({
  selector: 'app-worksheet-inbox',
  imports: [MatButtonToggleModule, MatCardModule, SheetGrid],
  template: `
    <mat-card appearance="outlined" class="panel">
      <mat-button-toggle-group
        aria-label="Which sheets"
        [value]="tab()"
        (change)="tab.set($event.value)"
      >
        <mat-button-toggle value="mine">Waiting for me ({{ mine().length }})</mat-button-toggle>
        <mat-button-toggle value="team">My team ({{ team().length }})</mat-button-toggle>
      </mat-button-toggle-group>

      @if (shown().length) {
        <app-sheet-grid
          [rows]="shown()"
          [today]="ctx.today"
          [locale]="ctx.locale.locale"
          (open)="open($event)"
        />
      } @else {
        <p class="empty">
          {{
            tab() === 'mine'
              ? 'Nothing is waiting for you right now.'
              : 'No other open sheets in your team.'
          }}
        </p>
      }
    </mat-card>
  `,
  styles: `
    .panel {
      padding: 1rem;
    }
    mat-button-toggle-group {
      margin-bottom: 1rem;
    }
    .empty {
      padding: 2rem 0;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorksheetInbox {
  protected readonly ctx = inject(WorksheetContext);
  private readonly router = inject(Router);

  protected readonly tab = signal<'mine' | 'team'>('mine');
  protected readonly mine = computed(() => this.ctx.rows().filter((r) => r.waiting));
  protected readonly team = computed(() => this.ctx.rows().filter((r) => !r.waiting && !r.closed));
  protected readonly shown = computed(() => (this.tab() === 'mine' ? this.mine() : this.team()));

  protected open(id: string): void {
    void this.router.navigate(['/worksheets', id]);
  }
}
