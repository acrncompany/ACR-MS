import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GetRowIdParams, RowClickedEvent } from 'ag-grid-community';
import { appGridTheme } from '../../../shared/ag-grid';
import { PagedGrid } from '../../../shared/components/paged-grid/paged-grid';
import { daysBetween, formatDate } from '../../../shared/utils/date';
import { SheetRow } from './worksheet.context';

/** The work sheet table shared by the list and "My Work" pages. */
@Component({
  selector: 'app-sheet-grid',
  imports: [AgGridAngular, PagedGrid],
  template: `
    @if (paged()) {
      <app-paged-grid
        [rows]="rows()"
        [columns]="columns()"
        [quickFilter]="quickFilter()"
        [getRowId]="rowId"
        [getRowClass]="rowClass"
        (rowClick)="onRowData($event)"
      />
    } @else {
      <ag-grid-angular
        class="app-grid"
        [theme]="theme"
        [rowData]="rows()"
        [columnDefs]="columns()"
        [defaultColDef]="defaultColDef"
        [quickFilterText]="quickFilter()"
        [getRowId]="rowId"
        [getRowClass]="rowClass"
        [rowClass]="'clickable'"
        domLayout="autoHeight"
        (rowClicked)="onRow($event)"
      />
    }
  `,
  styles: `
    :host {
      display: block;
    }
    :host(.paged) {
      display: flex;
      flex: 1 1 0;
      flex-direction: column;
      min-height: 0;
    }
  `,
  host: { '[class.paged]': 'paged()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetGrid {
  readonly rows = input.required<SheetRow[]>();
  readonly quickFilter = input('');
  readonly today = input.required<string>();
  readonly locale = input.required<string>();
  /** Fill the parent's height with a pager and scroll inside, instead of growing with the rows. */
  readonly paged = input(false);
  readonly open = output<string>();

  protected readonly theme = appGridTheme;
  protected readonly defaultColDef: ColDef<SheetRow> = { sortable: true, resizable: true };
  protected readonly rowId = (p: GetRowIdParams<SheetRow>): string => p.data.id;
  protected readonly rowClass = (p: { data?: SheetRow }): string | undefined =>
    p.data?.overdue ? 'row-overdue' : undefined;

  protected readonly columns = computed<ColDef<SheetRow>[]>(() => {
    const locale = this.locale();
    const today = this.today();
    return [
      { field: 'workNo', headerName: 'Work No', minWidth: 130, flex: 1, sort: 'desc' },
      { field: 'clientName', headerName: 'Client', minWidth: 200, flex: 2 },
      { field: 'workType', headerName: 'Work', minWidth: 150, flex: 1.2 },
      { field: 'period', headerName: 'Period', minWidth: 120, flex: 1 },
      {
        field: 'stageOrder',
        headerName: 'Stage',
        minWidth: 190,
        flex: 1.4,
        cellRenderer: (p: { data?: SheetRow }) => {
          const wrap = document.createElement('span');
          const row = p.data;
          if (!row) return wrap;
          const chip = document.createElement('span');
          chip.className = `status status--${row.tone}`;
          chip.textContent = row.sentBack ? `${row.stage} · rework` : row.stage;
          wrap.appendChild(chip);
          return wrap;
        },
      },
      {
        field: 'target',
        headerName: 'Target',
        minWidth: 150,
        flex: 1.1,
        valueFormatter: (p) => formatDate(p.value as string, locale) || '—',
        cellRenderer: (p: { data?: SheetRow; valueFormatted?: string }) => {
          const wrap = document.createElement('span');
          const row = p.data;
          wrap.textContent = p.valueFormatted ?? '';
          if (row?.overdue) {
            const days = daysBetween(row.target, today);
            const note = document.createElement('strong');
            note.textContent = ` · ${days}d overdue`;
            wrap.appendChild(note);
          }
          return wrap;
        },
      },
      {
        headerName: 'Assigned to',
        minWidth: 190,
        flex: 1.6,
        sortable: false,
        valueGetter: (p) => p.data?.assignees.slice(1).join(' → ') || p.data?.assignees[0] || '—',
      },
      {
        field: 'received',
        headerName: 'Received',
        minWidth: 120,
        flex: 1,
        valueFormatter: (p) => formatDate(p.value as string, locale),
      },
    ];
  });

  protected onRowData(row: unknown): void {
    this.open.emit((row as SheetRow).id);
  }

  protected onRow(event: RowClickedEvent<SheetRow>): void {
    if (event.data) this.open.emit(event.data.id);
  }
}
