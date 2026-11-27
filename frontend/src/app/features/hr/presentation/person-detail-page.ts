import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SessionService } from '../../../core/auth/session.service';
import { AppConfigService } from '../../../core/config/app-config.service';
import { toApiError } from '../../../core/http/api-error';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { formatDate } from '../../../shared/utils/date';
import {
  AdditionalDocument,
  DocumentKind,
  GENDER_LABELS,
  PendingDocument,
  ID_PROOF_LABELS,
  MARITAL_LABELS,
  PERSON_LABELS,
  PersonDetail,
  PersonKind,
} from '../domain/people-directory.models';
import { PeopleDirectoryRepository } from '../domain/people-directory.repository';
import { AdditionalDocuments } from './additional-documents';
import { DocumentPicker } from './document-picker';
import { viewStoredDocument } from './document-viewer-dialog';

const DOCUMENT_TITLES: Record<DocumentKind, string> = {
  'id-proof': 'ID proof',
  resume: 'Resume / CV',
  passbook: 'Passbook copy',
};

/** Read-only profile of an employee or article, with its documents (view, and replace). */
@Component({
  selector: 'app-person-detail-page',
  imports: [
    AdditionalDocuments,
    DocumentPicker,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    PageHeader,
    RouterLink,
  ],
  template: `
    @if (error(); as message) {
      <p class="error" role="alert">{{ message }}</p>
    } @else if (person(); as p) {
      <app-page-header [title]="p.name" [badge]="p.code">
        <a mat-stroked-button [routerLink]="backLink">
          <mat-icon>arrow_back</mat-icon> All {{ labels.plural.toLowerCase() }}
        </a>
        @if (canEdit) {
          <a mat-flat-button [routerLink]="[backLink, p.id, 'edit']">
            <mat-icon>edit</mat-icon> Edit
          </a>
        }
      </app-page-header>

      <mat-card appearance="outlined" class="card">
        <h2>Basic details</h2>
        <dl class="facts">
          <div>
            <dt>Code</dt>
            <dd>{{ p.code }}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{{ p.email || '—' }}</dd>
          </div>
          <div>
            <dt>Mob No.</dt>
            <dd>{{ p.mobNo || '—' }}</dd>
          </div>
          <div>
            <dt>Date of joining</dt>
            <dd>{{ date(p.joinDate) }}</dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{{ p.departmentName || '—' }}</dd>
          </div>
          <div>
            <dt>Designation</dt>
            <dd>{{ p.designationName || '—' }}</dd>
          </div>
          <div>
            <dt>Reporting manager</dt>
            <dd>{{ p.reportingManagerName || '—' }}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{{ p.status }}</dd>
          </div>
        </dl>
      </mat-card>

      <mat-card appearance="outlined" class="card">
        <h2>Personal details</h2>
        <dl class="facts">
          <div>
            <dt>Date of birth</dt>
            <dd>{{ p.dateOfBirth ? date(p.dateOfBirth) : '—' }}</dd>
          </div>
          <div>
            <dt>Gender</dt>
            <dd>{{ p.gender ? genders[p.gender] : '—' }}</dd>
          </div>
          <div>
            <dt>Marital status</dt>
            <dd>{{ p.maritalStatus ? maritalStatuses[p.maritalStatus] : '—' }}</dd>
          </div>
        </dl>
      </mat-card>

      <mat-card appearance="outlined" class="card">
        <h2>Address</h2>
        <dl class="facts">
          <div>
            <dt>House name</dt>
            <dd>{{ p.address.houseName || '—' }}</dd>
          </div>
          <div>
            <dt>Post office</dt>
            <dd>{{ p.address.postOffice || '—' }}</dd>
          </div>
          <div>
            <dt>District</dt>
            <dd>{{ p.address.district || '—' }}</dd>
          </div>
          <div>
            <dt>Pin code</dt>
            <dd>{{ p.address.pinCode || '—' }}</dd>
          </div>
          <div>
            <dt>State</dt>
            <dd>{{ p.address.state || '—' }}</dd>
          </div>
        </dl>
      </mat-card>

      <mat-card appearance="outlined" class="card">
        <h2>Emergency contact</h2>
        <dl class="facts">
          <div>
            <dt>Name</dt>
            <dd>{{ p.emergencyContact.name || '—' }}</dd>
          </div>
          <div>
            <dt>Relation</dt>
            <dd>{{ p.emergencyContact.relation || '—' }}</dd>
          </div>
          <div>
            <dt>Mob No.</dt>
            <dd>{{ p.emergencyContact.mobNo || '—' }}</dd>
          </div>
        </dl>
      </mat-card>

      <mat-card appearance="outlined" class="card">
        <h2>Documents</h2>
        <dl class="facts">
          <div>
            <dt>ID proof type</dt>
            <dd>{{ p.idProofType ? idProofTypes[p.idProofType] : '—' }}</dd>
          </div>
        </dl>
        <div class="docs">
          <app-document-picker
            label="ID proof file"
            [existing]="p.documents.idProof"
            [busy]="uploading()"
            [canChoose]="canUpload"
            [hint]="canUpload ? 'PDF, JPG or PNG, up to 2 MB' : ''"
            (fileChosen)="upload('id-proof', $event)"
            (view)="view('id-proof')"
          />
          <app-document-picker
            label="Resume / CV"
            accept=".pdf,.doc,.docx"
            [hint]="canUpload ? 'PDF, DOC or DOCX, up to 2 MB' : ''"
            [existing]="p.documents.resume"
            [busy]="uploading()"
            [canChoose]="canUpload"
            (fileChosen)="upload('resume', $event)"
            (view)="view('resume')"
          />
        </div>
        <!-- Second line: additional documents, any number. -->
        <div class="extra">
          <app-additional-documents
            [saved]="p.additionalDocuments"
            [canAdd]="canUpload"
            [immediate]="true"
            [busy]="uploading()"
            (upload)="uploadExtra($event)"
            (viewSaved)="viewExtra($event)"
          />
        </div>
      </mat-card>

      <mat-card appearance="outlined" class="card">
        <h2>Bank details</h2>
        <dl class="facts">
          <div>
            <dt>Account holder name</dt>
            <dd>{{ p.bank.accountHolder || '—' }}</dd>
          </div>
          <div>
            <dt>Bank name</dt>
            <dd>{{ p.bank.bankName || '—' }}</dd>
          </div>
          <div>
            <dt>Branch</dt>
            <dd>{{ p.bank.branch || '—' }}</dd>
          </div>
          <div>
            <dt>Account number</dt>
            <dd>{{ p.bank.accountNumber || '—' }}</dd>
          </div>
          <div>
            <dt>IFSC</dt>
            <dd>{{ p.bank.ifsc || '—' }}</dd>
          </div>
        </dl>
        <div class="docs">
          <app-document-picker
            label="Passbook copy"
            [hint]="canUpload ? 'PDF, JPG or PNG, up to 2 MB' : ''"
            [existing]="p.documents.passbook"
            [busy]="uploading()"
            [canChoose]="canUpload"
            (fileChosen)="upload('passbook', $event)"
            (view)="view('passbook')"
          />
        </div>
      </mat-card>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .card {
      margin-bottom: 1rem;
      padding: 1rem 1.25rem;
    }
    h2 {
      margin: 0 0 0.75rem;
      font: var(--mat-sys-title-medium);
    }
    .facts {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
      gap: 0.75rem 1.5rem;
      margin: 0;
    }
    dt {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }
    dd {
      margin: 0.1rem 0 0;
      font: var(--mat-sys-body-large);
    }
    .docs {
      display: flex;
      flex-wrap: wrap;
      gap: 2rem;
      margin-top: 1rem;
    }
    .extra {
      margin-top: 1rem;
    }
    .error {
      color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonDetailPage {
  private readonly repo = inject(PeopleDirectoryRepository);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly locale = inject(AppConfigService).config.locale.locale;
  private readonly route = inject(ActivatedRoute).snapshot;
  protected readonly kind: PersonKind = this.route.data['kind'];
  private readonly id = this.route.paramMap.get('id') ?? '';
  protected readonly labels = PERSON_LABELS[this.kind];
  protected readonly backLink = this.kind === 'employee' ? '/hr/people' : '/hr/people/articles';
  private readonly session = inject(SessionService);
  protected readonly canUpload = this.session.can('hr.create');
  protected readonly canEdit = this.session.can('hr.edit');

  protected readonly genders = GENDER_LABELS;
  protected readonly maritalStatuses = MARITAL_LABELS;
  protected readonly idProofTypes = ID_PROOF_LABELS;

  protected readonly person = signal<PersonDetail | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly uploading = signal(false);

  constructor() {
    this.load();
  }

  private load(): void {
    this.repo.person(this.kind, this.id).subscribe({
      next: (p) => this.person.set(p),
      error: (e: unknown) => this.error.set(toApiError(e).message),
    });
  }

  protected date(iso: string): string {
    return formatDate(iso, this.locale);
  }

  protected view(document: DocumentKind): void {
    const info = this.person()?.documents;
    const doc =
      document === 'id-proof'
        ? info?.idProof
        : document === 'resume'
          ? info?.resume
          : info?.passbook;
    viewStoredDocument(
      this.dialog,
      this.repo.document(this.kind, this.id, document),
      { title: DOCUMENT_TITLES[document], fileName: doc?.fileName ?? document },
      (e) => this.snackBar.open(toApiError(e).message, 'OK', { duration: 6000 }),
    );
  }

  protected viewExtra(doc: AdditionalDocument): void {
    viewStoredDocument(
      this.dialog,
      this.repo.additionalDocument(this.kind, this.id, doc.id),
      { title: doc.title || 'Additional document', fileName: doc.fileName },
      (e) => this.snackBar.open(toApiError(e).message, 'OK', { duration: 6000 }),
    );
  }

  protected uploadExtra(item: PendingDocument): void {
    if (!this.canUpload) return;
    this.uploading.set(true);
    this.repo.uploadAdditionalDocument(this.kind, this.id, item.file, item.title).subscribe({
      next: () => {
        this.uploading.set(false);
        this.snackBar.open('Document added', 'OK', { duration: 3000 });
        this.load();
      },
      error: (e: unknown) => {
        this.uploading.set(false);
        this.snackBar.open(toApiError(e).message, 'OK', { duration: 8000 });
      },
    });
  }

  protected upload(document: DocumentKind, file: File): void {
    if (!this.canUpload) return;
    this.uploading.set(true);
    this.repo.uploadDocument(this.kind, this.id, document, file).subscribe({
      next: () => {
        this.uploading.set(false);
        this.snackBar.open('File uploaded', 'OK', { duration: 3000 });
        this.load();
      },
      error: (e: unknown) => {
        this.uploading.set(false);
        this.snackBar.open(toApiError(e).message, 'OK', { duration: 8000 });
      },
    });
  }
}
