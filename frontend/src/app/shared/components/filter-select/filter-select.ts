import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

export interface FilterOption {
  value: string;
  label: string;
}

/** Compact dropdown pill for filter bars: "Stage ⌄", or "Stage: Review" once a value is picked. */
@Component({
  selector: 'app-filter-select',
  imports: [MatIconModule, MatMenuModule],
  template: `
    <button
      type="button"
      class="filter-pill"
      [class.filter-pill--active]="!!value()"
      [matMenuTriggerFor]="menu"
      [attr.aria-label]="'Filter by ' + label()"
    >
      <span class="filter-pill__text">{{ text() }}</span>
      <mat-icon>expand_more</mat-icon>
    </button>
    <mat-menu #menu="matMenu" class="filter-menu">
      <button mat-menu-item type="button" (click)="value.set('')">
        <span>All</span>
      </button>
      @for (option of options(); track option.value) {
        <button mat-menu-item type="button" (click)="value.set(option.value)">
          <span [class.selected]="option.value === value()">{{ option.label }}</span>
        </button>
      }
    </mat-menu>
  `,
  styles: `
    :host {
      display: inline-block;
    }
    .selected {
      color: var(--mat-sys-primary);
      font-weight: 600;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterSelect {
  readonly label = input.required<string>();
  readonly options = input.required<FilterOption[]>();
  readonly value = model('');

  protected readonly text = computed(() => {
    const picked = this.options().find((o) => o.value === this.value());
    return picked ? `${this.label()}: ${picked.label}` : this.label();
  });
}
