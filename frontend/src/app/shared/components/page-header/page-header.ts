import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Page title with a slot (`<ng-content />`) for actions. */
@Component({
  selector: 'app-page-header',
  template: `
    <div>
      <h1>{{ title() }}</h1>
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
    .actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeader {
  readonly title = input.required<string>();
}
