import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

interface PeopleTab {
  label: string;
  route: string;
  /** Route prefixes (create, detail pages) that keep this tab highlighted. */
  alsoUnder?: string[];
}

/** People hub: same top bar as Masters; each item is a child route. */
@Component({
  selector: 'app-people-hub-page',
  imports: [RouterLink, RouterOutlet],
  template: `
    <div class="bar">
      <h1 class="title">People</h1>
      <nav class="tabs" aria-label="People">
        @for (tab of tabs; track tab.route) {
          <a class="item" [routerLink]="tab.route" [class.active]="isActive(tab)">{{
            tab.label
          }}</a>
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
  private readonly router = inject(Router);

  /** Current URL without query/fragment; updates after every navigation. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.currentPath()),
    ),
    { initialValue: this.currentPath() },
  );

  protected readonly tabs: PeopleTab[] = [
    { label: 'Employees', route: '/hr/people', alsoUnder: ['/hr/people/employees'] },
    { label: 'Articles', route: '/hr/people/articles', alsoUnder: ['/hr/people/articles'] },
    { label: 'Designations', route: '/hr/people/designations' },
    { label: 'Departments', route: '/hr/people/departments' },
  ];

  /** A tab is active on its own route, and on the create/detail pages that belong to it. */
  protected isActive(tab: PeopleTab): boolean {
    const url = this.url();
    return (
      url === tab.route ||
      (tab.alsoUnder ?? []).some((prefix) => url === prefix || url.startsWith(`${prefix}/`))
    );
  }

  private currentPath(): string {
    return this.router.url.split(/[?#]/)[0];
  }
}
