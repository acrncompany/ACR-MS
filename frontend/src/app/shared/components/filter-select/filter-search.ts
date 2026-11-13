import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Compact search box that matches the filter pills. */
@Component({
  selector: 'app-filter-search',
  imports: [MatIconModule],
  template: `
    <label class="filter-pill filter-pill--search">
      <mat-icon>search</mat-icon>
      <input
        type="search"
        [placeholder]="placeholder()"
        [attr.aria-label]="placeholder()"
        [value]="value()"
        (input)="value.set(box.value)"
        #box
      />
    </label>
  `,
  styles: `
    :host {
      display: inline-block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterSearch {
  readonly placeholder = input('Search');
  readonly value = model('');
}
