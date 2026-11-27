import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Page title with a slot (`<ng-content />`) for actions. */
@Component({
  selector: 'app-page-header',
  template: `
    <div>
      @if (title()) {
        <h1>
          {{ title() }}
          @if (badge()) {
            <span class="badge">{{ badge() }}</span>
          }
        </h1>
      }
    </div>
    <div class="actions"><ng-content /></div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      margin-bottom: 1.25rem;
    }
    h1 {
      margin: 0;
      font: var(--mat-sys-headline-medium);
      font-weight: 600;
    }
    .badge {
      margin-left: 0.5rem;
      padding: 0.1rem 0.6rem;
      border-radius: 999px;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font: var(--mat-sys-label-large);
      vertical-align: middle;
      white-space: nowrap;
    }
    .actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeader {
  /** Empty hides the heading (the page already shows its name elsewhere). */
  readonly title = input('');
  /** Small chip next to the title, e.g. a permanent code. */
  readonly badge = input('');
}
