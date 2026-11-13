import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

const FIELD_STYLES = `
  :host {
    display: block;
  }
  mat-form-field {
    width: 100%;
  }
`;

/** Text, date or multi-line field bound with `[(value)]`. Read-only fields keep their look. */
@Component({
  selector: 'app-ws-text',
  imports: [MatFormFieldModule, MatInputModule],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>{{ label() }}</mat-label>
      @if (type() === 'textarea') {
        <textarea
          matInput
          rows="2"
          [value]="value()"
          [readonly]="readonly()"
          (input)="value.set(box.value)"
          #box
        ></textarea>
      } @else {
        <input
          matInput
          [type]="type()"
          [value]="value()"
          [readonly]="readonly()"
          [attr.inputmode]="type() === 'tel' ? 'tel' : null"
          (input)="value.set(field.value)"
          #field
        />
      }
    </mat-form-field>
  `,
  styles: FIELD_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WsText {
  readonly label = input.required<string>();
  readonly type = input<'text' | 'date' | 'tel' | 'email' | 'textarea'>('text');
  readonly readonly = input(false);
  readonly value = model('');
}

@Component({
  selector: 'app-ws-number',
  imports: [MatFormFieldModule, MatInputModule],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>{{ label() }}</mat-label>
      @if (prefix()) {
        <span matTextPrefix>{{ prefix() }}&nbsp;</span>
      }
      <input
        matInput
        type="number"
        min="0"
        [value]="value() ?? ''"
        [readonly]="readonly()"
        (input)="value.set(field.value === '' ? null : field.valueAsNumber)"
        #field
      />
    </mat-form-field>
  `,
  styles: FIELD_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WsNumber {
  readonly label = input.required<string>();
  readonly prefix = input('');
  readonly readonly = input(false);
  readonly value = model<number | null>(null);
}

export interface WsOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-ws-select',
  imports: [MatFormFieldModule, MatSelectModule],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>{{ label() }}</mat-label>
      <mat-select
        [value]="value()"
        [disabled]="readonly()"
        (selectionChange)="value.set($event.value)"
      >
        @if (allowEmpty()) {
          <mat-option value="">—</mat-option>
        }
        @for (option of options(); track option.value) {
          <mat-option [value]="option.value">{{ option.label }}</mat-option>
        }
      </mat-select>
    </mat-form-field>
  `,
  styles: FIELD_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WsSelect {
  readonly label = input.required<string>();
  readonly options = input.required<WsOption[]>();
  readonly readonly = input(false);
  readonly allowEmpty = input(true);
  readonly value = model('');
}
