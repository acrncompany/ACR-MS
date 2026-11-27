import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { ColDef } from 'ag-grid-community';
import { SessionService } from '../../../core/auth/session.service';
import { toApiError } from '../../../core/http/api-error';
import { statusColumn, textColumn } from '../../../shared/ag-grid';
import { DataPage, SummaryItem } from '../../../shared/components/data-page/data-page';
import { FilterSelect } from '../../../shared/components/filter-select/filter-select';
import { Client } from '../domain/client.models';
import { ClientRepository } from '../domain/client.repository';

interface Row {
  id: string;
  clientCode: string;
  name: string;
  organisationTypeLabel: string;
  pan: string;
  gstin: string;
  city: string;
  laws: string;
  team: string;
  status: 'Active' | 'Inactive';
}

/**
 * The client master list. Search (name, code, PAN, GSTIN), the status filter and the paging all
 * happen on the server.
 */
@Component({
  selector: 'app-clients-page',
  imports: [DataPage, FilterSelect, MatButtonModule, MatIconModule, RouterLink],
  template: `
    <app-data-page
      searchPlaceholder="Code, name, PAN"
      [summary]="summary()"
      [columns]="columns"
      [rows]="rows()"
      [serverSide]="true"
      [total]="total()"
      [page]="page()"
      [pageSize]="pageSize()"
      [loading]="loading()"
      [errorMessage]="error()"
      (queryChange)="onQuery($event)"
      (rowClick)="open($event)"
    >
      <ng-container actions>
        @if (canCreate) {
          <a mat-flat-button class="new-client" routerLink="/masters/clients/new">
            <mat-icon>add</mat-icon>
            New client
          </a>
        }
      </ng-container>
      <ng-container filters>
        <app-filter-select
          label="Status"
          [options]="statusOptions"
          [(value)]="status"
          (valueChange)="onStatus()"
        />
      </ng-container>
    </app-data-page>
  `,
  styles: `
    .new-client {
      --mat-button-filled-container-shape: 0;
      --mat-button-filled-container-height: 30px;
      --mat-button-filled-horizontal-padding: 12px;
      --mat-button-filled-container-color: var(--brand-deep);
      --mat-button-filled-label-text-color: #ffffff;
      --mat-button-filled-label-text-size: 13px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsPage {
  private readonly router = inject(Router);
  private readonly repo = inject(ClientRepository);
  protected readonly canCreate = inject(SessionService).can('clients.create');

  protected readonly status = signal('');
  protected readonly statusOptions = [
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'Inactive' },
  ];

  private readonly items = signal<Client[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private search = '';

  constructor() {
    this.load();
  }

  protected readonly rows = computed<Row[]>(() =>
    this.items().map((c) => ({
      id: c.id,
      clientCode: c.clientCode,
      name: c.name,
      organisationTypeLabel: c.organisationTypeLabel,
      pan: c.pan,
      gstin: c.gstin,
      city: c.city,
      laws: c.lawKeys.join(', '),
      team: c.team.join(', '),
      status: c.active ? 'Active' : 'Inactive',
    })),
  );

  protected readonly summary = computed<SummaryItem[]>(() => [
    { label: 'Clients', value: String(this.total()), icon: 'business_center' },
  ]);

  protected onQuery(query: { search: string; page: number; pageSize: number }): void {
    this.search = query.search;
    this.page.set(query.page);
    this.pageSize.set(query.pageSize);
    this.load();
  }

  protected onStatus(): void {
    this.page.set(1);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    const active = this.status() === '' ? null : this.status() === 'Active';
    this.repo
      .list({ q: this.search, page: this.page(), pageSize: this.pageSize(), active })
      .subscribe({
        next: (result) => {
          this.items.set(result.items);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: (e: unknown) => {
          this.items.set([]);
          this.total.set(0);
          this.loading.set(false);
          this.error.set(toApiError(e).message);
        },
      });
  }

  protected open(row: unknown): void {
    void this.router.navigate(['/masters/clients', (row as Row).id]);
  }

  protected readonly columns: ColDef<Row>[] = [
    { ...textColumn<Row>('clientCode', 'Code'), minWidth: 110, flex: 0.8, sortable: false },
    {
      ...textColumn<Row>('name', 'Client', 2),
      minWidth: 220,
      sortable: false,
      cellStyle: { fontSize: '12px' },
    },
    { ...textColumn<Row>('organisationTypeLabel', 'Type'), minWidth: 130, sortable: false },
    { ...textColumn<Row>('pan', 'PAN'), sortable: false },
    {
      ...textColumn<Row>('gstin', 'GSTIN', 2),
      minWidth: 170,
      sortable: false,
      valueFormatter: (p) => p.value || '—',
    },
    { ...textColumn<Row>('city', 'City'), sortable: false },
    { ...textColumn<Row>('laws', 'Laws', 2), minWidth: 200, sortable: false },
    { ...textColumn<Row>('team', 'Assigned team', 2), minWidth: 180, sortable: false },
    { ...statusColumn<Row>('status'), sortable: false },
  ];
}
