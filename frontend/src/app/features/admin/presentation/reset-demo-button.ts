import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DirectoryRepository } from '../domain/directory.repository';
import { ConfirmDialog } from './admin-dialogs';

/** Restores the sample organization, roles and users after demo edits (mock mode only). */
@Component({
  selector: 'app-reset-demo-button',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <button mat-stroked-button type="button" (click)="reset()">
      <mat-icon>restart_alt</mat-icon>
      Reset demo data
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetDemoButton {
  private readonly repo = inject(DirectoryRepository);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected reset(): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: 'Reset demo data?',
          message:
            'This discards all changes to the organization, users and roles and restores the sample firm.',
          confirmLabel: 'Reset',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.repo.resetDemoData().subscribe({
          next: () => this.snackBar.open('Demo data restored', 'OK', { duration: 3000 }),
          error: (e: Error) => this.snackBar.open(e.message, 'OK', { duration: 5000 }),
        });
      });
  }
}
