import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AppConfigService } from '../config/app-config.service';
import { homeRoute } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { SessionService } from '../auth/session.service';
import { ThemeService } from '../theme/theme.service';
import { NAV_ITEMS } from './nav-items';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
    MatTooltipModule,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  protected readonly theme = inject(ThemeService);
  protected readonly branding = inject(AppConfigService).config.branding;
  protected readonly user = this.session.user;

  /** Features that still use sample data, shown as a chip so nobody mistakes them for real data. */
  protected readonly mockFeatures = inject(AppConfigService).mockFeatures;
  protected readonly navGroups = computed(() => {
    this.user(); // re-evaluate when the signed-in user changes
    const allowed = NAV_ITEMS.filter((item) => this.session.can(item.permission));
    // Sections keep the order in which NAV_ITEMS first mentions them.
    const sections = [...new Set(allowed.map((item) => item.section))];
    return sections.map((section) => ({
      section,
      items: allowed.filter((item) => item.section === section),
    }));
  });
  protected readonly collapsed = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split('?')[0]),
    ),
    { initialValue: this.router.url.split('?')[0] },
  );
  /** The welcome banner shows on each role's landing page. */
  protected readonly showWelcome = computed(() => {
    this.user();
    return this.url() === homeRoute(this.session);
  });
  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  });
  protected readonly today = new Intl.DateTimeFormat(
    inject(AppConfigService).config.locale.locale,
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  ).format(new Date());
  protected readonly drawerOpen = signal(false);

  protected readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 900px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  /** The rail is only collapsed on desktop; the mobile drawer is always full width. */
  protected readonly rail = computed(() => this.collapsed() && !this.isMobile());
  protected readonly initial = computed(() => this.user()?.name.charAt(0).toUpperCase() ?? '?');

  protected toggleSidebar(): void {
    if (this.isMobile()) {
      this.drawerOpen.update((v) => !v);
    } else {
      this.collapsed.update((v) => !v);
    }
  }

  protected signOut(): void {
    this.auth.logout().subscribe({ error: () => undefined });
  }

  protected signOutEverywhere(): void {
    this.auth.logoutAll().subscribe({ error: () => undefined });
  }
}
