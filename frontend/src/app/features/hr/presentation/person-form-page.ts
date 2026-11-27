import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, concatMap, from, map, of, toArray } from 'rxjs';
import { toApiError } from '../../../core/http/api-error';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { dateToIso, isoToDate, provideDayFirstDatepicker } from '../../../shared/utils/date-picker';
import {
  DirectoryOption,
  DirectoryStatus,
  DocumentKind,
  GENDER_LABELS,
  ID_PROOF_LABELS,
  IdProofType,
  MARITAL_LABELS,
  PERSON_LABELS,
  PendingDocument,
  PersonInput,
  PersonKind,
} from '../domain/people-directory.models';
import { PeopleDirectoryRepository } from '../domain/people-directory.repository';
import { AdditionalDocuments } from './additional-documents';
import { DocumentPicker } from './document-picker';
import { showDocument } from './document-viewer-dialog';

const notBlank = [Validators.required, Validators.pattern(/\S/)];
const MOB_NO = /^[0-9+\-\s]{8,15}$/;
const PIN_CODE = /^[0-9]{4,10}$/;
const IFSC = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/;
const ACCOUNT_NUMBER = /^[0-9A-Za-z]{5,34}$/;

const DOCUMENT_LABELS: Record<DocumentKind, string> = {
  'id-proof': 'ID proof',
  resume: 'Resume / CV',
  passbook: 'Passbook copy',
};

/**
 * "New employee" / "New article" (route data `kind`): a full page, not a dialog. The record is
 * saved first; the chosen files are then uploaded one by one (each at most 2 MB).
 */
@Component({
  selector: 'app-person-form-page',
  imports: [
    AdditionalDocuments,
    DocumentPicker,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    PageHeader,
    ReactiveFormsModule,
    RouterLink,
  ],
  providers: [provideDayFirstDatepicker()],
  templateUrl: './person-form-page.html',
  styleUrl: './person-form-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonFormPage {
  private readonly repo = inject(PeopleDirectoryRepository);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute).snapshot;
  protected readonly kind: PersonKind = this.route.data['kind'];
  /** Set on the edit route (`:id/edit`); the new-record route has no id. */
  private readonly personId = this.route.paramMap.get('id');
  protected readonly editing = this.personId !== null;
  protected readonly labels = PERSON_LABELS[this.kind];
  protected readonly backLink = this.kind === 'employee' ? '/hr/people' : '/hr/people/articles';
  /** Cancel goes back to the record when editing, to the list when creating. */
  protected readonly cancelLink = this.personId
    ? `${this.backLink}/${this.personId}`
    : this.backLink;
  /** Shown in the header when editing; a new record has no code until it is saved. */
  protected readonly code = signal<string | null>(null);

  protected readonly statuses: DirectoryStatus[] = ['Active', 'Inactive'];
  /** Only these choices are offered on the form. */
  protected readonly genders = (['MALE', 'FEMALE'] as const).map((g) => [g, GENDER_LABELS[g]]);
  protected readonly maritalStatuses = (['SINGLE', 'MARRIED'] as const).map((m) => [
    m,
    MARITAL_LABELS[m],
  ]);
  protected readonly idProofTypes = Object.entries(ID_PROOF_LABELS);

  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly departments = signal<DirectoryOption[]>([]);
  private readonly allDesignations = signal<DirectoryOption[]>([]);
  private readonly managers = signal<DirectoryOption[]>([]);
  /** Possible reporting managers (nobody reports to themselves). */
  protected readonly managerChoices = computed(() =>
    this.managers().filter((m) => m.id !== this.personId),
  );

  /** Additional documents chosen on the form, uploaded after the record is saved. */
  protected readonly extras = signal<PendingDocument[]>([]);

  /** Chosen files, uploaded after the record is saved. */
  private readonly files = signal<Partial<Record<DocumentKind, File>>>({});

  protected readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', notBlank],
    lastName: [''],
    email: ['', Validators.email],
    mobNo: ['', Validators.pattern(MOB_NO)],
    joinDate: [null as Date | null, Validators.required],
    departmentId: [''],
    designationId: [''],
    reportingManagerId: [''],
    status: ['Active' as DirectoryStatus],
    dateOfBirth: [null as Date | null],
    gender: [''],
    maritalStatus: [''],
    houseName: [''],
    postOffice: [''],
    district: [''],
    pinCode: ['', Validators.pattern(PIN_CODE)],
    state: [''],
    emergencyName: [''],
    emergencyRelation: [''],
    emergencyMobNo: ['', Validators.pattern(MOB_NO)],
    idProofType: [''],
    bankAccountHolder: [''],
    bankName: [''],
    bankAccountNumber: ['', Validators.pattern(ACCOUNT_NUMBER)],
    bankIfsc: ['', Validators.pattern(IFSC)],
    bankBranch: [''],
  });

  private readonly departmentId = toSignal(this.form.controls.departmentId.valueChanges, {
    initialValue: '',
  });
  /** Designations of the chosen department (all of them while no department is chosen). */
  protected readonly designations = computed(() => {
    const department = this.departmentId();
    return department
      ? this.allDesignations().filter((d) => d.departmentId === department)
      : this.allDesignations();
  });

  constructor() {
    // No code preview: the server issues the code atomically when the record is saved.
    this.repo.departmentOptions().subscribe((d) => this.departments.set(d));
    this.repo.designationOptions().subscribe((d) => this.allDesignations.set(d));
    this.repo.employeeOptions().subscribe((e) => this.managers.set(e));
    if (this.personId) this.loadForEdit(this.personId);

    const destroyed = takeUntilDestroyed(inject(DestroyRef));
    // A designation belongs to one department: choosing it sets the department, and changing
    // the department clears a designation of another department.
    this.form.controls.designationId.valueChanges.pipe(destroyed).subscribe((id) => {
      const designation = this.allDesignations().find((d) => d.id === id);
      if (designation?.departmentId) {
        this.form.controls.departmentId.setValue(designation.departmentId);
      }
    });
    this.form.controls.departmentId.valueChanges.pipe(destroyed).subscribe((department) => {
      const current = this.allDesignations().find(
        (d) => d.id === this.form.controls.designationId.value,
      );
      if (current && department && current.departmentId !== department) {
        this.form.controls.designationId.setValue('');
      }
    });
  }

  private loadForEdit(id: string): void {
    this.repo.person(this.kind, id).subscribe({
      next: (p) => {
        this.code.set(p.code);
        this.form.patchValue({
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          mobNo: p.mobNo,
          joinDate: isoToDate(p.joinDate),
          departmentId: p.departmentId ?? '',
          designationId: p.designationId ?? '',
          reportingManagerId: p.reportingManagerId ?? '',
          status: p.status,
          dateOfBirth: isoToDate(p.dateOfBirth),
          gender: p.gender ?? '',
          maritalStatus: p.maritalStatus ?? '',
          houseName: p.address.houseName,
          postOffice: p.address.postOffice,
          district: p.address.district,
          pinCode: p.address.pinCode,
          state: p.address.state,
          emergencyName: p.emergencyContact.name,
          emergencyRelation: p.emergencyContact.relation,
          emergencyMobNo: p.emergencyContact.mobNo,
          idProofType: p.idProofType ?? '',
          bankAccountHolder: p.bank.accountHolder,
          bankName: p.bank.bankName,
          bankAccountNumber: p.bank.accountNumber,
          bankIfsc: p.bank.ifsc,
          bankBranch: p.bank.branch,
        });
      },
      error: (e: unknown) => this.serverError.set(toApiError(e).message),
    });
  }

  /** Preview of a file chosen but not saved yet. */
  protected preview(kind: DocumentKind): void {
    const file = this.files()[kind];
    if (file)
      showDocument(this.dialog, { title: DOCUMENT_LABELS[kind], fileName: file.name, blob: file });
  }

  protected unchoose(kind: DocumentKind): void {
    this.files.update((f) => {
      const rest = { ...f };
      delete rest[kind];
      return rest;
    });
  }

  protected choose(kind: DocumentKind, file: File): void {
    this.files.update((f) => ({ ...f, [kind]: file }));
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const text = (value: string) => value.trim();
    const input: PersonInput = {
      firstName: text(v.firstName),
      lastName: text(v.lastName),
      email: text(v.email),
      mobNo: text(v.mobNo),
      departmentId: v.departmentId || null,
      designationId: v.designationId || null,
      reportingManagerId: v.reportingManagerId || null,
      joinDate: dateToIso(v.joinDate),
      status: v.status,
      dateOfBirth: dateToIso(v.dateOfBirth) || null,
      gender: (v.gender || null) as PersonInput['gender'],
      maritalStatus: (v.maritalStatus || null) as PersonInput['maritalStatus'],
      address: {
        houseName: text(v.houseName),
        postOffice: text(v.postOffice),
        district: text(v.district),
        pinCode: text(v.pinCode),
        state: text(v.state),
      },
      emergencyContact: {
        name: text(v.emergencyName),
        relation: text(v.emergencyRelation),
        mobNo: text(v.emergencyMobNo),
      },
      idProofType: (v.idProofType || null) as IdProofType | null,
      bank: {
        accountHolder: text(v.bankAccountHolder),
        bankName: text(v.bankName),
        accountNumber: text(v.bankAccountNumber),
        ifsc: text(v.bankIfsc).toUpperCase(),
        branch: text(v.bankBranch),
      },
    };

    this.saving.set(true);
    this.serverError.set(null);
    if (this.personId) {
      this.repo.updatePerson(this.kind, this.personId, input).subscribe({
        next: (updated) => {
          this.snackBar.open('Saved', 'OK', { duration: 3000 });
          void this.router.navigate([this.backLink, updated.id]);
        },
        error: (e: unknown) => this.fail(e),
      });
      return;
    }
    this.repo.createPerson(this.kind, input).subscribe({
      next: (created) => {
        // One upload at a time; a failed file does not stop the others.
        const uploads: Observable<string | null>[] = [
          ...(Object.entries(this.files()) as [DocumentKind, File][]).map(([kind, file]) =>
            this.repo.uploadDocument(this.kind, created.id, kind, file).pipe(
              map(() => null),
              catchError(() => of(DOCUMENT_LABELS[kind])),
            ),
          ),
          ...this.extras().map((item) =>
            this.repo.uploadAdditionalDocument(this.kind, created.id, item.file, item.title).pipe(
              map(() => null),
              catchError(() => of(item.title || item.file.name)),
            ),
          ),
        ];
        from(uploads)
          .pipe(
            concatMap((upload) => upload),
            toArray(),
          )
          .subscribe((results) => {
            const failed = results.filter((r): r is string => r !== null);
            this.snackBar.open(
              failed.length
                ? `Saved as ${created.code}, but could not upload: ${failed.join(', ')}. Upload them again from the record.`
                : `Saved as ${created.code}`,
              'OK',
              { duration: failed.length ? 10000 : 3000 },
            );
            void this.router.navigate([this.backLink]);
          });
      },
      error: (e: unknown) => this.fail(e),
    });
  }

  private fail(e: unknown): void {
    this.saving.set(false);
    const error = toApiError(e);
    const fields = Object.entries(error.fields).map(([path, msg]) => `${path}: ${msg}`);
    this.serverError.set(fields.length ? `${error.message} (${fields.join('; ')})` : error.message);
  }
}
