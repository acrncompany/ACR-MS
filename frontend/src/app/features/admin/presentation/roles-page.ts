import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SessionService } from '../../../core/auth/session.service';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { ACTIONS, Action, Role, WORKSHEET_ACTIONS } from '../domain/admin.models';
import { DirectoryRepository } from '../domain/directory.repository';
import { NameDialog } from './admin-dialogs';
import { ResetDemoButton } from './reset-demo-button';

@Component({
  selector: 'app-roles-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatIconModule,
    PageHeader,
    ResetDemoButton,
  ],
  template: `
    <app-page-header
      title="Roles & permissions"
    >
      @if (canCreate) {
        <button mat-flat-button type="button" (click)="addRole()">
          <mat-icon>add</mat-icon>
          Add role
        </button>
      }
      <app-reset-demo-button />
    </app-page-header>

    <mat-card appearance="outlined" class="matrix-card">
      <div class="scroll" tabindex="0" role="region" aria-label="Permission matrix">
        <table class="matrix">
          <thead>
            <tr>
              <th rowspan="2" class="module">Module</th>
              @for (role of roles(); track role.id) {
                <th colspan="4" class="role" [class.role--locked]="role.locked">
                  {{ role.name }}
                  @if (role.locked) {
                    <mat-icon class="lock" aria-label="Locked">lock</mat-icon>
                  }
                </th>
              }
            </tr>
            <tr>
              @for (role of roles(); track role.id) {
                @for (action of actions; track action) {
                  <th class="action">{{ action }}</th>
                }
              }
            </tr>
          </thead>
          <tbody>
            @for (module of standardModules(); track module.key) {
              <tr>
                <th scope="row" class="module">{{ module.label }}</th>
                @for (role of roles(); track role.id) {
                  @for (action of actions; track action) {
                    <td class="cell">
                      <mat-checkbox
                        [checked]="has(role, module.key, action)"
                        [disabled]="role.locked || !canEdit"
                        [aria-label]="role.name + ' ' + action + ' ' + module.label"
                        (change)="toggle(role, module.key, action, $event.checked)"
                      />
                    </td>
                  }
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    </mat-card>

    <h2 class="section-title">Work sheet actions</h2>
    <p class="section-hint">
      Each stage of the work sheet flow is its own permission, so who does what can change without
      touching the workflow. Who may see a sheet still follows the reporting hierarchy.
    </p>
    <mat-card appearance="outlined" class="matrix-card">
      <div class="scroll" tabindex="0" role="region" aria-label="Work sheet permission matrix">
        <table class="matrix matrix--single">
          <thead>
            <tr>
              <th class="module">Action</th>
              @for (role of roles(); track role.id) {
                <th class="role" [class.role--locked]="role.locked">
                  {{ role.name }}
                  @if (role.locked) {
                    <mat-icon class="lock" aria-label="Locked">lock</mat-icon>
                  }
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (item of worksheetActions; track item.action) {
              <tr>
                <th scope="row" class="module">
                  {{ item.label }}
                  <span class="hint">{{ item.hint }}</span>
                </th>
                @for (role of roles(); track role.id) {
                  <td class="cell">
                    <mat-checkbox
                      [checked]="has(role, 'worksheet', item.action)"
                      [disabled]="role.locked || !canEdit"
                      [aria-label]="role.name + ' ' + item.label"
                      (change)="toggle(role, 'worksheet', item.action, $event.checked)"
                    />
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    </mat-card>
  `,
  styleUrl: './roles-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesPage {
  private readonly repo = inject(DirectoryRepository);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly session = inject(SessionService);

  protected readonly canCreate = this.session.can('roles.create');
  protected readonly canEdit = this.session.can('roles.edit');
  protected readonly roles = this.repo.roles;
  protected readonly modules = this.repo.modules;
  protected readonly standardModules = computed(() => this.modules().filter((m) => !m.separate));
  protected readonly actions: readonly Action[] = ACTIONS;
  protected readonly worksheetActions = WORKSHEET_ACTIONS;

  protected has(role: Role, module: string, action: Action): boolean {
    return role.permissions[module]?.includes(action) ?? false;
  }

  protected toggle(role: Role, module: string, action: Action, enabled: boolean): void {
    this.repo.setPermission(role.id, module, action, enabled).subscribe({
      error: (e: Error) => this.snackBar.open(e.message, 'OK', { duration: 6000 }),
    });
  }

  protected addRole(): void {
    this.dialog
      .open(NameDialog, {
        data: { title: 'Add role', label: 'Role name', confirmLabel: 'Add' },
      })
      .afterClosed()
      .subscribe((name?: string) => name && this.repo.addRole(name).subscribe());
  }
}
