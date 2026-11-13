import { Pipe, PipeTransform, inject } from '@angular/core';
import { AppConfigService } from '../../core/config/app-config.service';
import { formatMoney } from '../utils/money';

/** Formats an amount using the currency/locale from runtime config. */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  private readonly locale = inject(AppConfigService).config.locale;

  transform(value: number, currency: string = this.locale.currency): string {
    return formatMoney(value, this.locale.locale, currency);
  }
}
