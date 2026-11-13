import { ChangeDetectionStrategy, Component, Injector, computed, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ColDef } from 'ag-grid-community';
import { textColumn } from '../../../shared/ag-grid';
import { DataPage, SummaryItem } from '../../../shared/components/data-page/data-page';
import { Client } from '../domain/client.models';
import { ClientRepository } from '../domain/client.repository';
import { loaded } from '../../../shared/utils/loaded';
import { ClientDetailDialog } from './client-detail-dialog';

type M = Client;

@Component({
  selector: 'app-clients-page',
  imports: [DataPage],
  template: `
    <app-data-page
      title="Clients"
      [summary]="summary()"
      [columns]="columns"
      [rows]="rows()"
      (rowClick)="open($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsPage {
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly repo = inject(ClientRepository);
  private readonly list = loaded(() => this.repo.list());
  protected readonly rows = this.list.rows;

  protected open(row: unknown): void {
    this.dialog.open(ClientDetailDialog, {
      // The dialog reads the client repository, which this route provides.
      injector: this.injector,
      width: 'min(46rem, 96vw)',
      data: { client: row as Client, onChanged: () => this.list.reload() },
    });
  }

  protected readonly columns: ColDef<M>[] = [
    { ...textColumn<M>('name', 'Client', 2), minWidth: 220 },
    textColumn<M>('pan', 'PAN'),
    { ...textColumn<M>('gstin', 'GSTIN', 2), minWidth: 170, valueFormatter: (p) => p.value || '—' },
    textColumn<M>('city', 'City'),
    {
      headerName: 'Services',
      flex: 2,
      minWidth: 220,
      valueGetter: (p) => p.data?.services.join(', '),
    },
    {
      headerName: 'Assigned team',
      flex: 2,
      minWidth: 180,
      valueGetter: (p) => p.data?.team.join(', '),
    },
  ];

  protected readonly summary = computed<SummaryItem[]>(() => {
    const rows = this.rows();
    return [
      { label: 'Clients', value: String(rows.length), icon: 'apartment' },
      {
        label: 'GST registered',
        value: String(rows.filter((c) => c.gstin).length),
        icon: 'receipt_long',
        tone: 'blue',
      },
      {
        label: 'Audit clients',
        value: String(rows.filter((c) => c.services.some((s) => /audit/i.test(s))).length),
        icon: 'fact_check',
        tone: 'violet',
      },
    ];
  });
}
