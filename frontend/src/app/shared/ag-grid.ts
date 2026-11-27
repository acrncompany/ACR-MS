import {
  CellStyleModule,
  ClientSideRowModelModule,
  ColDef,
  ModuleRegistry,
  PaginationModule,
  QuickFilterModule,
  RowStyleModule,
  colorSchemeVariable,
  themeQuartz,
} from 'ag-grid-community';
import { formatDate } from './utils/date';
import { formatMoney } from './utils/money';
import { statusTone } from './utils/status';

// Only the AG Grid modules the app uses (keeps the bundle small). Registered once, here.
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  CellStyleModule,
  PaginationModule,
  QuickFilterModule,
  RowStyleModule,
]);

/** Colours come from Material tokens through `.app-grid` in styles.scss. */
export const appGridTheme = themeQuartz.withPart(colorSchemeVariable).withParams({
  fontFamily: 'inherit',
  wrapperBorderRadius: 0,
  borderRadius: 0,
  fontSize: 13,
  headerFontSize: 12,
  headerFontWeight: 700,
  rowHeight: 32,
  headerHeight: 34,
  cellHorizontalPadding: 10,
  columnBorder: true,
  rowBorder: true,
});

/** Narrows a plain property name to the field type AG Grid expects for rows of type T. */
function fieldOf<T>(field: keyof T & string): ColDef<T>['field'] {
  return field as unknown as ColDef<T>['field'];
}

export interface MoneyLocale {
  locale: string;
  currency: string;
}

export function dateColumn<T>(
  field: keyof T & string,
  headerName: string,
  locale: string,
): ColDef<T> {
  return {
    field: fieldOf<T>(field),
    headerName,
    flex: 1,
    minWidth: 120,
    valueFormatter: (p) => (typeof p.value === 'string' ? formatDate(p.value, locale) : ''),
    // ISO strings sort correctly as text.
  };
}

/** A column with Approve / Reject buttons (shown only while `isOpen(row)` is true). */
export function decisionColumn<T>(
  isOpen: (row: T) => boolean,
  onDecide: (row: T, decision: 'Approved' | 'Rejected') => void,
): ColDef<T> {
  return {
    headerName: 'Action',
    flex: 1,
    minWidth: 190,
    sortable: false,
    cellRenderer: (p: { data?: T }) => {
      const wrap = document.createElement('span');
      const row = p.data;
      if (!row || !isOpen(row)) return wrap;
      wrap.className = 'grid-actions';
      for (const [label, decision] of [
        ['Approve', 'Approved'],
        ['Reject', 'Rejected'],
      ] as const) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.className = `grid-btn grid-btn--${decision === 'Approved' ? 'ok' : 'bad'}`;
        button.addEventListener('click', () => onDecide(row, decision));
        wrap.appendChild(button);
      }
      return wrap;
    },
  };
}

export function textColumn<T>(field: keyof T & string, headerName: string, flex = 1): ColDef<T> {
  return { field: fieldOf<T>(field), headerName, flex, minWidth: 110 };
}

export function numberColumn<T>(field: keyof T & string, headerName: string): ColDef<T> {
  return { field: fieldOf<T>(field), headerName, flex: 1, minWidth: 100, type: 'rightAligned' };
}

export function moneyColumn<T>(
  field: keyof T & string,
  headerName: string,
  money: MoneyLocale,
): ColDef<T> {
  return {
    field: fieldOf<T>(field),
    headerName,
    flex: 1,
    minWidth: 120,
    type: 'rightAligned',
    valueFormatter: (p) =>
      typeof p.value === 'number' ? formatMoney(p.value, money.locale, money.currency) : '',
  };
}

export function statusColumn<T>(field: keyof T & string, headerName = 'Status'): ColDef<T> {
  return {
    field: fieldOf<T>(field),
    headerName,
    flex: 1,
    minWidth: 120,
    cellRenderer: (p: { value: string }) => {
      const chip = document.createElement('span');
      chip.className = `status status--${statusTone(p.value)}`;
      chip.textContent = p.value;
      return chip;
    },
  };
}

/** A column of icon buttons (Material Symbols), e.g. a pencil to edit the row. */
export function iconActionsColumn<T>(
  actions: {
    icon: string;
    /** When set, shown instead of the Material icon. */
    emoji?: string;
    /** Draws the button in the theme's error (red) colour; works with the icon, not the emoji. */
    danger?: boolean;
    title: string;
    run: (row: T) => void;
    visible?: (row: T) => boolean;
  }[],
): ColDef<T> {
  return {
    headerName: 'Action',
    width: 90,
    minWidth: 90,
    maxWidth: 90,
    sortable: false,
    resizable: false,
    cellRenderer: (p: { data?: T }) => {
      const wrap = document.createElement('span');
      const row = p.data;
      if (!row) return wrap;
      wrap.className = 'grid-actions';
      for (const action of actions) {
        if (action.visible && !action.visible(row)) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.title = action.title;
        button.setAttribute('aria-label', action.title);
        button.className = action.danger ? 'grid-icon-btn grid-icon-btn--danger' : 'grid-icon-btn';
        const glyph = document.createElement('span');
        if (action.emoji) {
          glyph.textContent = action.emoji;
        } else {
          glyph.className = 'material-symbols-rounded';
          glyph.textContent = action.icon;
        }
        button.appendChild(glyph);
        button.addEventListener('click', (event) => {
          // The button's own action: never also open the row.
          event.stopPropagation();
          action.run(row);
        });
        wrap.appendChild(button);
      }
      return wrap;
    },
  };
}

/** A column of small text buttons (e.g. Edit, Deactivate) that call back with the row. */
export function actionsColumn<T>(
  actions: { label: (row: T) => string; run: (row: T) => void; visible?: (row: T) => boolean }[],
): ColDef<T> {
  return {
    headerName: 'Actions',
    flex: 1,
    minWidth: 190,
    sortable: false,
    cellRenderer: (p: { data?: T }) => {
      const wrap = document.createElement('span');
      const row = p.data;
      if (!row) return wrap;
      wrap.className = 'grid-actions';
      for (const action of actions) {
        if (action.visible && !action.visible(row)) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = action.label(row);
        button.className = 'grid-btn grid-btn--plain';
        button.addEventListener('click', () => action.run(row));
        wrap.appendChild(button);
      }
      return wrap;
    },
  };
}
