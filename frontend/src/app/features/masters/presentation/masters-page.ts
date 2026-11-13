import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface MasterTab {
  label: string;
  route: string;
}

/** Masters hub: a compact horizontal bar of master data sets; each item is a child route. */
@Component({
  selector: 'app-masters-page',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <nav class="bar" aria-label="Masters">
      @for (tab of tabs; track tab.route) {
        <a class="item" [routerLink]="tab.route" routerLinkActive="active">{{ tab.label }}</a>
      }
    </nav>
    <div class="content"><router-outlet /></div>
  `,
  styles: `
    :host {
      display: block;
      margin-top: -0.25rem;
    }
    /* Full-width band; the items sit on the left, room on the right for future masters. */
    .bar {
      display: flex;
      box-sizing: border-box;
      width: 100%;
      gap: 0.25rem;
      padding: 0.25rem;
      border-radius: 14px;
      background: var(--mat-sys-secondary-container);
      border: 1px solid var(--mat-sys-outline-variant);
      max-width: 100%;
      overflow-x: auto;
    }
    .item {
      padding: 0.5rem 1.25rem;
      border-radius: 10px;
      white-space: nowrap;
      text-decoration: none;
      color: var(--mat-sys-on-secondary-container);
      font: var(--mat-sys-label-large);
      transition:
        background-color 120ms ease,
        color 120ms ease;
    }
    .item:hover {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .item:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 1px;
    }
    .item.active {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }
    .content {
      padding-top: 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MastersPage {
  protected readonly tabs: MasterTab[] = [
    { label: 'Clients', route: 'clients' },
    { label: 'Works', route: 'works' },
  ];
}
