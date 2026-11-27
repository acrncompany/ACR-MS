import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { StaffView } from './staff-view';

/** Read-only staff profile with a link to the printable summary. */
@Component({
  selector: 'app-staff-profile-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, RouterLink],
  template: `
    <h2 mat-dialog-title>
      {{ staff.name }}
      <span class="code">{{ staff.employeeCode }}</span>
    </h2>
    <mat-dialog-content>
      <dl class="facts">
        <div>
          <dt>Position</dt>
          <dd>
            {{ staff.position }}
            @if (staff.designationCode) {
              <span class="chip">{{ staff.designationCode }}</span>
            }
          </dd>
        </div>
        <div>
          <dt>Department</dt>
          <dd>{{ staff.department }}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{{ staff.role }}</dd>
        </div>
        <div>
          <dt>Reports to</dt>
          <dd>{{ staff.manager }}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{{ staff.email }}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{{ staff.phone || '—' }}</dd>
        </div>
        <div>
          <dt>Date of birth</dt>
          <dd>{{ staff.dateOfBirth || '—' }}</dd>
        </div>
        <div>
          <dt>Date of joining</dt>
          <dd>{{ staff.dateOfJoining || '—' }}</dd>
        </div>
        <div class="wide">
          <dt>Address</dt>
          <dd>{{ staff.address || '—' }}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{{ staff.status }}</dd>
        </div>
      </dl>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Close</button>
      <a mat-stroked-button [routerLink]="['/print/staff', staff.id]" mat-dialog-close>
        <mat-icon>print</mat-icon> Print
      </a>
    </mat-dialog-actions>
  `,
  styles: `
    .facts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
      gap: 0.75rem 1.5rem;
      margin: 0;
      min-width: min(34rem, 80vw);
    }
    .facts .wide {
      grid-column: 1 / -1;
    }
    dt {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .code,
    .chip {
      margin-left: 0.5rem;
      padding: 0.1rem 0.6rem;
      border-radius: 999px;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font: var(--mat-sys-label-large);
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffProfileDialog {
  protected readonly staff = inject<StaffView>(MAT_DIALOG_DATA);
}
