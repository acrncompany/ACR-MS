import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface PeopleTab {
  label: string;
  route: string;
}

/** Employees hub: same top bar as Masters; each item is a child route. */
@Component({
  selector: 'app-people-hub-page',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="bar">
      <h1 class="title">Employees</h1>
      <nav class="tabs" aria-label="Employees">
        @for (tab of tabs; track tab.route) {
          <a
            class="item"
            [routerLink]="tab.route"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            >{{ tab.label }}</a
          >
        }
      </nav>
    </div>
    <div class="content"><router-outlet /></div>
  `,
  styles: `
    :host {
      display: block;
      margin-top: -0.25rem;
    }
    .bar {
      display: flex;
      align-items: center;
      box-sizing: border-box;
      width: 100%;
      gap: 1rem;
      padding: 0.35rem 0.5rem;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      max-width: 100%;
      overflow-x: auto;
    }
    .title {
      margin: 0;
      padding-right: 1rem;
      border-right: 1px solid var(--mat-sys-outline-variant);
      font: var(--mat-sys-title-large);
      font-weight: 600;
      white-space: nowrap;
    }
    .tabs {
      display: flex;
      gap: 0.25rem;
    }
    .item {
      padding: 0.4rem 1rem;
      border-radius: 8px;
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
      display: flex;
      flex: 1 1 0;
      flex-direction: column;
      min-height: 0;
      padding-top: 0.5rem;
    }
    .content > router-outlet + *:has(app-data-page) {
      display: flex;
      flex: 1 1 0;
      flex-direction: column;
      min-height: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeopleHubPage {
  protected readonly tabs: PeopleTab[] = [
    { label: 'Employees', route: '/hr/employees' },
    { label: 'Designations', route: '/hr/employees/designations' },
    { label: 'Departments', route: '/hr/employees/departments' },
  ];
}
