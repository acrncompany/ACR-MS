import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import {
  AdditionalDocument,
  MAX_DOCUMENT_BYTES,
  PendingDocument,
} from '../domain/people-directory.models';
import { showDocument } from './document-viewer-dialog';

const ACCEPT = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];

/**
 * Any number of extra documents (certificates and the like), each with an optional name.
 *
 * Two modes: on the new-record form the chosen files wait in a list (`pendingChange`) until the
 * record is saved; on a saved record (`immediate`) each file is handed over at once (`upload`) and
 * the saved ones are listed from `saved`.
 */
@Component({
  selector: 'app-additional-documents',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="box">
      <span class="label">Additional documents</span>
      @if (canAdd()) {
        <div class="add">
          <input
            class="title"
            type="text"
            maxlength="100"
            placeholder="Document name (optional)"
            aria-label="Document name"
            [value]="title()"
            (input)="title.set($any($event.target).value)"
          />
          <button
            mat-stroked-button
            class="choose"
            type="button"
            [disabled]="busy()"
            (click)="picker.click()"
          >
            <mat-icon>note_add</mat-icon> Add document
          </button>
          <span class="hint">PDF, JPG, PNG, DOC or DOCX, up to 2 MB each</span>
        </div>
        <input
          #picker
          type="file"
          hidden
          multiple
          [accept]="accept"
          (change)="onChange($event)"
          aria-label="Add additional documents"
        />
      }
      @if (error(); as message) {
        <span class="error" role="alert">{{ message }}</span>
      }

      @if (saved().length || pending().length) {
        <ul class="list">
          @for (doc of saved(); track doc.id) {
            <li>
              <mat-icon class="doc">description</mat-icon>
              <span class="name">{{ doc.title || doc.fileName }}</span>
              <span class="file">{{ doc.title ? doc.fileName : '' }}</span>
              <button
                mat-flat-button
                class="view"
                type="button"
                (click)="viewSaved.emit(doc)"
                aria-label="View file"
                title="View file"
              >
                <mat-icon>visibility</mat-icon>
              </button>
            </li>
          }
          @for (item of pending(); track item) {
            <li>
              <mat-icon class="doc">description</mat-icon>
              <span class="name">{{ item.title || item.file.name }}</span>
              <span class="file">{{ item.title ? item.file.name : '' }}</span>
              <button
                mat-flat-button
                class="view"
                type="button"
                (click)="preview(item)"
                aria-label="View file"
                title="View file"
              >
                <mat-icon>visibility</mat-icon>
              </button>
              <button
                type="button"
                class="remove"
                (click)="remove(item)"
                aria-label="Remove file"
                title="Remove file"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </li>
          }
        </ul>
      } @else if (!canAdd()) {
        <span class="file">None</span>
      }
    </div>
  `,
  styles: `
    .box {
      --doc-view-color: light-dark(#1565c0, #90caf9);
      --doc-view-on-color: light-dark(#ffffff, #0b2a4a);
      --doc-replace-color: light-dark(#d84315, #ffb74d);
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .label {
      font: var(--mat-sys-label-large);
    }
    .add {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .title {
      box-sizing: border-box;
      width: 16rem;
      height: 30px;
      padding: 0 0.6rem;
      border: 1px solid var(--mat-sys-outline);
      background: transparent;
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-body-small);
    }
    .title:focus {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: -1px;
    }
    .choose,
    .view {
      --mat-button-outlined-container-height: 30px;
      --mat-button-filled-container-height: 30px;
      --mat-button-outlined-horizontal-padding: 10px;
      --mat-button-filled-horizontal-padding: 10px;
      --mat-button-outlined-with-icon-horizontal-padding: 10px;
      --mat-button-filled-with-icon-horizontal-padding: 10px;
      --mat-button-outlined-label-text-size: 12px;
      --mat-button-filled-label-text-size: 12px;
      --mat-button-outlined-icon-spacing: 4px;
      --mat-button-filled-icon-spacing: 4px;
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
    .view mat-icon,
    .doc,
    .remove mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }
    .doc {
      color: var(--mat-sys-primary);
    }
    .hint,
    .file {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .error {
      color: var(--mat-sys-error);
      font: var(--mat-sys-body-small);
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    /* One grid row per document: icon, name, file name, then View and trash in fixed columns. */
    li {
      display: grid;
      grid-template-columns: 16px minmax(8rem, 14rem) minmax(8rem, 14rem) 2.25rem 1.75rem;
      align-items: center;
      column-gap: 0.75rem;
    }
    .name,
    .file {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .name {
      font: var(--mat-sys-body-medium);
      font-weight: 500;
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdditionalDocuments {
  private readonly dialog = inject(MatDialog);
  protected readonly accept = ACCEPT.join(',');

  /** Documents the record already has (saved-record mode). */
  readonly saved = input<AdditionalDocument[]>([]);
  readonly canAdd = input(true);
  /** Saved-record mode: hand each file over at once instead of keeping it in a list. */
  readonly immediate = input(false);
  readonly busy = input(false);

  /** New-record mode: the files waiting to be uploaded after the record is saved. */
  readonly pendingChange = output<PendingDocument[]>();
  /** Saved-record mode: a file to upload now. */
  readonly upload = output<PendingDocument>();
  readonly viewSaved = output<AdditionalDocument>();

  protected readonly title = signal('');
  protected readonly pending = signal<PendingDocument[]>([]);
  protected readonly error = signal<string | null>(null);

  protected onChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // the same file can be chosen again
    const problems: string[] = [];
    const title = this.title().trim();
    for (const file of files) {
      const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!ACCEPT.includes(extension)) {
        problems.push(`${file.name}: this file type is not allowed`);
      } else if (file.size > MAX_DOCUMENT_BYTES) {
        problems.push(`${file.name}: larger than 2 MB`);
      } else if (this.immediate()) {
        this.upload.emit({ file, title: files.length === 1 ? title : '' });
      } else {
        this.pending.update((list) => [...list, { file, title: files.length === 1 ? title : '' }]);
      }
    }
    this.error.set(problems.length ? problems.join('; ') : null);
    if (files.length && !problems.length) this.title.set('');
    if (!this.immediate()) this.pendingChange.emit(this.pending());
  }

  protected remove(item: PendingDocument): void {
    this.pending.update((list) => list.filter((i) => i !== item));
    this.pendingChange.emit(this.pending());
  }

  protected preview(item: PendingDocument): void {
    showDocument(this.dialog, {
      title: item.title || 'Additional document',
      fileName: item.file.name,
      blob: item.file,
    });
  }
}
