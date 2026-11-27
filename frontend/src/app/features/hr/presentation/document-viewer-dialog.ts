import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable } from 'rxjs';

export interface DocumentViewerData {
  title: string;
  fileName: string;
  blob: Blob;
}

/** Shows a document in a modal: PDFs and images inline, anything else with a download button. */
@Component({
  selector: 'app-document-viewer-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <!-- The global dialog title band is green and DialogChrome adds the close button at its end;
         the full-screen button sits inside the same band, just before it. -->
    <h2 mat-dialog-title>
      <span class="title">{{ data.title }}</span>
      <button
        type="button"
        class="maximize"
        (click)="toggleMaximize()"
        [attr.aria-label]="maximized() ? 'Exit full screen' : 'Full screen'"
        [title]="maximized() ? 'Exit full screen' : 'Full screen'"
      >
        <mat-icon>{{ maximized() ? 'fullscreen_exit' : 'fullscreen' }}</mat-icon>
      </button>
    </h2>
    <mat-dialog-content class="body">
      @if (kind === 'pdf') {
        <iframe class="frame" [src]="safeUrl" [title]="data.title"></iframe>
      } @else if (kind === 'image') {
        <img class="image" [src]="url" [alt]="data.fileName" />
      } @else {
        <p class="none">A preview is not available for this file type. Download it to open it.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions class="foot">
      <span class="name">{{ data.fileName }}</span>
      <a mat-stroked-button [href]="url" [download]="data.fileName">
        <mat-icon>file_download</mat-icon> Download
      </a>
    </mat-dialog-actions>
  `,
  host: { '[class.maximized]': 'maximized()' },
  styles: `
    /* The component fills the dialog, so the file can fill what is left between the bars. */
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .title {
      flex: 1;
    }
    .maximize {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.3rem;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    .maximize:hover {
      background: color-mix(in srgb, var(--mat-sys-on-secondary) 18%, transparent);
    }
    .maximize mat-icon {
      width: 1.25rem;
      height: 1.25rem;
      font-size: 1.25rem;
    }
    /* File name centred, Download at the right. */
    .foot {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
    }
    .foot a {
      grid-column: 3;
      justify-self: end;
    }
    /* The global dialog style pads the content; the file should reach the edges. */
    .body {
      display: flex;
      justify-content: center;
      height: 70vh;
      padding: 0 !important;
    }
    :host(.maximized) .body {
      flex: 1;
      height: auto;
      min-height: 0;
    }
    .frame {
      width: 100%;
      height: 100%;
      border: 0;
    }
    .image {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .none {
      align-self: center;
      color: var(--mat-sys-on-surface-variant);
    }
    .name {
      grid-column: 2;
      overflow: hidden;
      max-width: 24rem;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentViewerDialog implements OnDestroy {
  protected readonly data = inject<DocumentViewerData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<DocumentViewerDialog>);
  protected readonly maximized = signal(false);
  /** An object URL of the file the user chose or the server sent, never of a typed address. */
  protected readonly url = URL.createObjectURL(this.data.blob);
  protected readonly safeUrl: SafeResourceUrl = inject(DomSanitizer).bypassSecurityTrustResourceUrl(
    this.url,
  );
  protected readonly kind: 'pdf' | 'image' | 'other' =
    this.data.blob.type === 'application/pdf'
      ? 'pdf'
      : this.data.blob.type.startsWith('image/')
        ? 'image'
        : 'other';

  protected toggleMaximize(): void {
    const next = !this.maximized();
    this.maximized.set(next);
    // The panel class lifts the app-wide 92vw dialog width limit (see styles.scss).
    if (next) this.ref.addPanelClass('dialog-maximized');
    else this.ref.removePanelClass('dialog-maximized');
    this.ref.updateSize(next ? '100vw' : '900px', next ? '100vh' : '');
  }

  ngOnDestroy(): void {
    URL.revokeObjectURL(this.url);
  }
}

export function showDocument(dialog: MatDialog, data: DocumentViewerData): void {
  dialog.open(DocumentViewerDialog, {
    data,
    width: '900px',
    maxWidth: '100vw',
    maxHeight: '100vh',
  });
}

/** Fetches a stored document, then shows it. `onError` is called when it could not be fetched. */
export function viewStoredDocument(
  dialog: MatDialog,
  source: Observable<Blob>,
  info: { title: string; fileName: string },
  onError: (error: unknown) => void,
): void {
  source.subscribe({ next: (blob) => showDocument(dialog, { ...info, blob }), error: onError });
}
