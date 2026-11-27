import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DocumentInfo, MAX_DOCUMENT_BYTES } from '../domain/people-directory.models';

/**
 * One document slot: choose a file (at most 2 MB, checked here and again by the server) and, when
 * the record already has a file, open it. The page decides what to do with the chosen file.
 */
@Component({
  selector: 'app-document-picker',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="slot">
      <span class="label">{{ label() }}</span>
      <div class="row">
        @if (canChoose()) {
          <button
            mat-stroked-button
            class="choose"
            type="button"
            (click)="picker.click()"
            [disabled]="busy()"
          >
            <mat-icon>note_add</mat-icon>
            {{ existing() || file() ? 'Replace file' : 'Choose file' }}
          </button>
        }
        @if (existing() || file()) {
          <button
            mat-flat-button
            class="view"
            type="button"
            (click)="view.emit()"
            aria-label="View file"
            title="View file"
          >
            <mat-icon>visibility</mat-icon>
          </button>
        }
        @if (file() ?? existing()) {
          <mat-icon class="doc">description</mat-icon>
        }
        @if (removable() && file()) {
          <button
            type="button"
            class="remove"
            (click)="remove()"
            aria-label="Remove file"
            title="Remove file"
          >
            <mat-icon>delete</mat-icon>
          </button>
        }
        <span class="name">{{ file()?.name ?? existing()?.fileName ?? 'No file' }}</span>
      </div>
      <span class="hint">{{ hint() }}</span>
      @if (error(); as message) {
        <span class="error" role="alert">{{ message }}</span>
      }
      <input
        #picker
        type="file"
        hidden
        [accept]="accept()"
        (change)="onChange($event)"
        [attr.aria-label]="label()"
      />
    </div>
  `,
  styles: `
    /* Fixed width, so a long file name never pushes the next slot (e.g. the resume) sideways. */
    .slot {
      width: 100%;
      max-width: 24rem;
      /* Action colours: view = blue, replace = orange (light and dark mode). */
      --doc-view-color: light-dark(#1565c0, #90caf9);
      --doc-view-on-color: light-dark(#ffffff, #0b2a4a);
      --doc-replace-color: light-dark(#d84315, #ffb74d);
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    /* Compact buttons: choose/replace = outlined orange, view = solid blue. */
    .choose,
    .view {
      --mat-button-outlined-container-height: 30px;
      --mat-button-filled-container-height: 30px;
      --mat-button-outlined-horizontal-padding: 10px;
      --mat-button-filled-horizontal-padding: 10px;
      --mat-button-outlined-label-text-size: 12px;
      --mat-button-filled-label-text-size: 12px;
      --mat-button-outlined-icon-spacing: 4px;
      --mat-button-filled-icon-spacing: 4px;
      --mat-button-outlined-with-icon-horizontal-padding: 10px;
      --mat-button-filled-with-icon-horizontal-padding: 10px;
    }
    .choose {
      --mat-button-outlined-label-text-color: var(--doc-replace-color);
      --mat-button-outlined-outline-color: var(--doc-replace-color);
    }
    .view {
      --mat-button-filled-container-color: var(--doc-view-color);
      --mat-button-filled-label-text-color: var(--doc-view-on-color);
    }
    .choose mat-icon,
    .view mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }
    .view {
      --mat-button-filled-horizontal-padding: 0;
      --mat-button-filled-with-icon-horizontal-padding: 0;
      min-width: 36px;
      padding: 0;
    }
    .view mat-icon {
      margin: 0;
    }
    .remove {
      margin-left: 0.5rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.2rem;
      border: 0;
      border-radius: 4px;
      background: transparent;
      color: var(--mat-sys-error);
      cursor: pointer;
    }
    .remove:hover {
      background: color-mix(in srgb, var(--mat-sys-error) 12%, transparent);
    }
    .remove mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }
    .label {
      font: var(--mat-sys-label-large);
    }
    .row {
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      gap: 0.5rem;
    }
    .doc {
      width: 16px;
      height: 16px;
      font-size: 16px;
      color: var(--mat-sys-primary);
    }
    .name {
      overflow: hidden;
      flex: 1;
      min-width: 0;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .hint {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .error {
      color: var(--mat-sys-error);
      font: var(--mat-sys-body-small);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentPicker {
  readonly label = input.required<string>();
  /** Allowed extensions, e.g. ".pdf,.jpg,.jpeg,.png". */
  readonly accept = input('.pdf,.jpg,.jpeg,.png');
  readonly hint = input('PDF, JPG or PNG, up to 2 MB');
  /** The file the record already has (shows "View" and its name). */
  readonly existing = input<DocumentInfo | null>(null);
  readonly busy = input(false);
  /** False for viewers who may open the file but not upload (hr.create). */
  readonly canChoose = input(true);
  /** Show a trash button for a chosen file that is not saved yet (the new-record form). */
  readonly removable = input(false);
  readonly fileChosen = output<File>();
  readonly view = output<void>();
  readonly fileRemoved = output<void>();

  protected readonly file = signal<File | null>(null);
  /** The file chosen here (not yet uploaded), for a preview before saving. */
  readonly chosen = this.file.asReadonly();
  protected readonly error = signal<string | null>(null);

  protected onChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chosen = input.files?.item(0) ?? null;
    input.value = ''; // the same file can be chosen again
    if (!chosen) return;
    const extension = chosen.name.slice(chosen.name.lastIndexOf('.')).toLowerCase();
    if (!this.accept().split(',').includes(extension)) {
      this.error.set(`This file type is not allowed (${this.accept().replaceAll(',', ', ')})`);
      return;
    }
    if (chosen.size > MAX_DOCUMENT_BYTES) {
      this.error.set('The file is larger than 2 MB');
      return;
    }
    this.error.set(null);
    this.file.set(chosen);
    this.fileChosen.emit(chosen);
  }

  protected remove(): void {
    this.file.set(null);
    this.error.set(null);
    this.fileRemoved.emit();
  }

  /** Forget the chosen file (the page calls it after a successful upload). */
  clear(): void {
    this.file.set(null);
  }
}
