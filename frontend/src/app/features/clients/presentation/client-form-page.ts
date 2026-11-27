import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { toApiError } from '../../../core/http/api-error';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { dateToIso, isoToDate, provideDayFirstDatepicker } from '../../../shared/utils/date-picker';
import {
  Client,
  ClientInput,
  ClientReferenceData,
  Director,
  TeamOption,
} from '../domain/client.models';
import { ClientRepository } from '../domain/client.repository';

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const DIN = /^[0-9]{8}$/;
const PHONE = /^[0-9+\-\s]{8,15}$/;
/** CIN (21 characters), LLPIN (AAA-1234) or ICAI Firm Registration Number (6 digits, a letter). */
const CIN_FRN = /^([LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}|[A-Z]{3}-[0-9]{4}|[0-9]{6}[A-Z]?)$/;

/** GSTIN characters 3 to 12 are the PAN of the taxpayer. */
function gstinMatchesPan(group: AbstractControl): ValidationErrors | null {
  const pan = String(group.get('pan')?.value ?? '').toUpperCase();
  const gstin = String(group.get('gstin')?.value ?? '').toUpperCase();
  return pan && gstin.length === 15 && gstin.slice(2, 12) !== pan ? { gstinPan: true } : null;
}

let rowSeed = 0;

function directorGroup(fb: NonNullableFormBuilder, d?: Director) {
  return fb.group({
    id: [d?.id ?? `d-${++rowSeed}-${Date.now().toString(36)}`],
    name: [d?.name ?? '', [Validators.required, Validators.pattern(/\S/)]],
    din: [d?.din ?? '', Validators.pattern(DIN)],
    phone: [d?.phone ?? '', Validators.pattern(PHONE)],
    email: [d?.email ?? '', Validators.email],
    kycStatus: [d?.kycStatus ?? ('pending' as Director['kycStatus'])],
  });
}

/** Create (`/masters/clients/new`) and edit (`/masters/clients/:id/edit`) of a client master. */
@Component({
  selector: 'app-client-form-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    PageHeader,
    RouterLink,
  ],
  providers: [provideDayFirstDatepicker()],
  templateUrl: './client-form-page.html',
  styleUrl: './client-form-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientFormPage {
  /** Route parameter; absent when creating. */
  readonly id = input<string>();

  private readonly repo = inject(ClientRepository);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly reference = signal<ClientReferenceData>({
    organisationTypes: [],
    laws: [],
    kycStatuses: [],
  });
  private readonly activeTeam = signal<TeamOption[]>([]);
  protected readonly existing = signal<Client | null>(null);
  protected readonly nextCode = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly loadError = signal<string | null>(null);
  /** Problems the SERVER found (it validates everything again), shown above the form. */
  protected readonly serverProblems = signal<string[]>([]);
  protected readonly selectedLaws = signal<string[]>([]);

  /** Active staff plus anyone already on the team (so a deactivated member stays visible). */
  protected readonly teamOptions = computed<TeamOption[]>(() => {
    const options = new Map(this.activeTeam().map((o) => [o.id, o]));
    const client = this.existing();
    client?.teamIds.forEach((id, i) => {
      if (!options.has(id)) options.set(id, { id, name: `${client.team[i]} (inactive)` });
    });
    return [...options.values()];
  });

  protected readonly form = this.fb.group(
    {
      name: ['', [Validators.required, Validators.pattern(/\S/)]],
      organisationType: ['', Validators.required],
      cinFrn: ['', Validators.pattern(CIN_FRN)],
      incorporationDate: this.fb.control<Date | null>(null),
      pan: ['', [Validators.required, Validators.pattern(PAN)]],
      gstin: ['', Validators.pattern(GSTIN)],
      email: ['', Validators.email],
      phone: ['', Validators.pattern(PHONE)],
      address: ['', Validators.required],
      city: [''],
      previousAuditor: [''],
      teamIds: this.fb.control<string[]>([]),
      directors: this.fb.array<ReturnType<typeof directorGroup>>([]),
    },
    { validators: gstinMatchesPan },
  );

  protected get directors() {
    return this.form.controls.directors;
  }

  protected readonly title = computed(() =>
    this.existing() ? `Edit ${this.existing()?.name}` : 'New client',
  );
  protected readonly badge = computed(() => this.existing()?.clientCode ?? '');
  protected readonly backLink = computed(() =>
    this.existing() ? ['/masters/clients', this.existing()?.id] : ['/masters/clients'],
  );

  constructor() {
    this.repo.referenceData().subscribe((r) => this.reference.set(r));
    this.repo.teamOptions().subscribe((t) => this.activeTeam.set(t));
    effect(() => {
      const id = this.id();
      untracked(() => {
        if (id) {
          this.load(id);
          return;
        }
        this.addDirector();
        // Preview only: the server issues the real code when the client is saved.
        this.repo.nextCode().subscribe({
          next: (code) => this.nextCode.set(code),
          error: () => undefined,
        });
      });
    });
  }

  protected addDirector(director?: Director): void {
    this.directors.push(directorGroup(this.fb, director));
  }

  protected removeDirector(index: number): void {
    this.directors.removeAt(index);
  }

  private load(id: string): void {
    this.repo.get(id).subscribe({
      next: (client) => this.fill(client),
      error: (e: unknown) => this.loadError.set(toApiError(e).message),
    });
  }

  private fill(client: Client): void {
    this.existing.set(client);
    this.directors.clear();
    client.directors.forEach((d) => this.addDirector(d));
    this.selectedLaws.set([...client.lawKeys]);
    this.form.patchValue({
      name: client.name,
      organisationType: client.organisationType,
      cinFrn: client.cinFrn,
      incorporationDate: isoToDate(client.incorporationDate),
      pan: client.pan,
      gstin: client.gstin,
      email: client.email,
      phone: client.phone,
      address: client.address,
      city: client.city,
      previousAuditor: client.previousAuditor,
      teamIds: client.teamIds,
    });
  }

  protected lawChecked(key: string): boolean {
    return this.selectedLaws().includes(key);
  }

  protected toggleLaw(key: string, checked: boolean): void {
    this.selectedLaws.update((list) =>
      checked ? [...new Set([...list, key])] : list.filter((k) => k !== key),
    );
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const input: ClientInput = {
      name: v.name.trim(),
      organisationType: v.organisationType,
      cinFrn: v.cinFrn.trim().toUpperCase(),
      incorporationDate: dateToIso(v.incorporationDate),
      pan: v.pan.trim().toUpperCase(),
      gstin: v.gstin.trim().toUpperCase(),
      email: v.email.trim(),
      phone: v.phone.trim(),
      address: v.address.trim(),
      city: v.city.trim(),
      previousAuditor: v.previousAuditor.trim(),
      services: this.existing()?.services ?? [],
      teamIds: v.teamIds,
      lawKeys: this.reference()
        .laws.map((l) => l.key)
        .filter((k) => this.selectedLaws().includes(k)),
      directors: v.directors.map((d) => ({
        id: d.id,
        name: d.name.trim(),
        din: d.din.trim(),
        phone: d.phone.trim(),
        email: d.email.trim(),
        kycStatus: d.kycStatus,
      })),
    };
    this.saving.set(true);
    const id = this.id();
    const request = id ? this.repo.update(id, input) : this.repo.create(input);
    request.subscribe({
      next: (client) => {
        this.snackBar.open(id ? 'Client saved' : `Client ${client.clientCode} created`, 'OK', {
          duration: 3000,
        });
        void this.router.navigate(['/masters/clients', client.id]);
      },
      error: (e: unknown) => {
        this.saving.set(false);
        const problem = toApiError(e);
        // Mark the fields the server rejected, and list every message.
        const messages = Object.entries(problem.fields).map(
          ([path, message]) => `${path}: ${message}`,
        );
        for (const path of Object.keys(problem.fields)) {
          this.form.get(path)?.setErrors({ server: problem.fields[path] });
        }
        this.serverProblems.set(messages.length ? messages : [problem.message]);
        this.snackBar.open(problem.message, 'OK', { duration: 6000 });
      },
    });
  }
}
