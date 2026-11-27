import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { loadedState } from '../../../shared/utils/loaded';
import {
  ACTIONS,
  Action,
  MODULES,
  MODULE_EXTRA_ACTIONS,
  Role,
  WORKSHEET_ACTIONS,
} from '../domain/admin.models';
import { OrganizationRepository } from '../domain/organization.repository';

/**
 * The permission matrix, READ-ONLY for now: roles and their permissions come from the server.
 * Editing roles is on the backlog (it needs its own backend endpoints and audit trail).
 */
@Component({
  selector: 'app-roles-page',
  imports: [MatCardModule, MatCheckboxModule, PageHeader],
  template: `
    <app-page-header title="Roles & permissions" />

    <p class="section-hint">
      Read-only. Roles and what they may do are set up by the system administrator; editing them
      here is coming later.
    </p>

    @if (state().error; as message) {
      <p class="banner banner--error" role="alert">{{ message }}</p>
    } @else if (state().loading) {
      <p class="banner" role="status">Loading…</p>
    } @else if (!roles().length) {
      <p class="banner" role="status">No roles are set up yet.</p>
    }

    <mat-card appearance="outlined" class="matrix-card">
      <div class="scroll" tabindex="0" role="region" aria-label="Permission matrix">
        <table class="matrix">
          <thead>
            <tr>
              <th rowspan="2" class="module">Module</th>
              @for (role of roles(); track role.id) {
                <th colspan="4" class="role">{{ role.name }}</th>
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
            @for (module of standardModules; track module.key) {
              <tr>
                <th scope="row" class="module">{{ module.label }}</th>
                @for (role of roles(); track role.id) {
                  @for (action of actions; track action) {
                    <td class="cell">
                      <mat-checkbox
                        [checked]="has(role, module.key, action)"
                        [disabled]="true"
                        [aria-label]="role.name + ' ' + action + ' ' + module.label"
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

    <h2 class="section-title">Other actions</h2>
    <p class="section-hint">
      Deactivating staff or clients, and revealing client portal credentials, are separate
      permissions.
    </p>
    <mat-card appearance="outlined" class="matrix-card">
      <div class="scroll" tabindex="0" role="region" aria-label="Other permission matrix">
        <table class="matrix matrix--single">
          <thead>
            <tr>
              <th class="module">Action</th>
              @for (role of roles(); track role.id) {
                <th class="role">{{ role.name }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (item of extraActions; track item.module + item.action) {
              <tr>
                <th scope="row" class="module">
                  {{ item.label }}
                  <span class="hint">{{ item.hint }}</span>
                </th>
                @for (role of roles(); track role.id) {
                  <td class="cell">
                    <mat-checkbox
                      [checked]="has(role, item.module, item.action)"
                      [disabled]="true"
                      [aria-label]="role.name + ' ' + item.label"
                    />
                  </td>
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
                <th class="role">{{ role.name }}</th>
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
                      [disabled]="true"
                      [aria-label]="role.name + ' ' + item.label"
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
  private readonly repo = inject(OrganizationRepository);
  private readonly loaded = loadedState(() => this.repo.roles());

  protected readonly state = this.loaded.state;
  protected readonly roles = computed(() => this.loaded.state().rows);
  protected readonly standardModules = MODULES.filter((m) => !m.separate);
  protected readonly actions: readonly Action[] = ACTIONS;
  protected readonly extraActions = MODULE_EXTRA_ACTIONS;
  protected readonly worksheetActions = WORKSHEET_ACTIONS;

  protected has(role: Role, module: string, action: Action): boolean {
    return role.permissions.includes(`${module}.${action}`);
  }
}
