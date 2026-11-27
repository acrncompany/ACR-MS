import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';

/**
 * Gives every dialog the same chrome: a close button at the top right of the title bar. Dialogs
 * are configured not to close on a backdrop click or Escape (see `MAT_DIALOG_DEFAULT_OPTIONS` in
 * app.config), so this button and the dialog's own Cancel/Save buttons are the only ways out.
 */
@Injectable({ providedIn: 'root' })
export class DialogChrome {
  private readonly dialog = inject(MatDialog);

  /** Call once at startup. */
  init(): void {
    // The service-level event fires before the dialog's template is rendered; the dialog's own
    // `afterOpened` fires once its title exists.
    this.dialog.afterOpened.subscribe((ref) =>
      ref.afterOpened().subscribe(() => this.addCloseButton(ref)),
    );
  }

  private addCloseButton(ref: MatDialogRef<unknown>): void {
    const container = document.getElementById(ref.id);
    const title = container?.querySelector<HTMLElement>('.mat-mdc-dialog-title');
    if (!title || title.querySelector('.dialog-close')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dialog-close';
    button.title = 'Close';
    button.setAttribute('aria-label', 'Close');
    const glyph = document.createElement('span');
    glyph.className = 'material-symbols-rounded';
    glyph.textContent = 'close';
    button.appendChild(glyph);
    button.addEventListener('click', () => ref.close());
    title.appendChild(button);
  }
}
